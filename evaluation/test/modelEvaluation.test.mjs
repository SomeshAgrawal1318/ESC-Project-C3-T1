import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildEvaluationPrompt } from "../lib/evaluationPrompt.mjs";
import {
  evaluatePredictionDirectory,
  guardrailProfileFor,
} from "../lib/evaluationMetrics.mjs";
import {
  invokeCloudflare,
  invokeGemini,
  invokeOpenRouter,
  parseModelJson,
} from "../lib/modelProviders.mjs";
import { runModelEvaluation } from "../scripts/run-model-evaluation.mjs";

test("guardrail prompt contains safety rules but no ground-truth answers", () => {
  const prompt = buildEvaluationPrompt(
    { taskType: "ESSAY" },
    { guardrails: true },
  );
  assert.match(prompt, /Never normalize spelling/);
  assert.match(prompt, /Do not use or infer any answer key/);
  assert.doesNotMatch(prompt, /writing-16127-gt/);

  const unguarded = buildEvaluationPrompt(
    { taskType: "ESSAY" },
    { guardrails: false },
  );
  assert.doesNotMatch(unguarded, /Never normalize spelling/);
});

test("minimal guardrail profile keeps only transcription-safety constraints", () => {
  const prompt = buildEvaluationPrompt(
    { taskType: "ESSAY" },
    { guardrailProfile: "minimal" },
  );
  assert.match(prompt, /Preserve the child's apparent text exactly/);
  assert.match(prompt, /Ignore printed instructions and teacher markings/);
  assert.match(prompt, /Do not guess illegible words/);
  assert.doesNotMatch(prompt, /written and intended must differ/);
  assert.doesNotMatch(prompt, /Use unsure with low confidence/);
});

test("comparison metadata distinguishes explicit and historical guardrail profiles", () => {
  assert.equal(guardrailProfileFor({ guardrailProfile: "minimal" }), "minimal");
  assert.equal(guardrailProfileFor({ guardrails: false }), "none");
  assert.equal(guardrailProfileFor({ guardrails: true }), "full/legacy");
});

test("parseModelJson accepts plain JSON and fenced JSON", () => {
  assert.deepEqual(parseModelJson('{"errors":[]}'), { errors: [] });
  assert.deepEqual(parseModelJson('```json\n{"errors":[]}\n```'), {
    errors: [],
  });
});

test("OpenRouter adapter sends only prompt and supplied image to the provider", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return {
          choices: [
            { message: { content: '{"errors":[],"illegibleNote":""}' } },
          ],
        };
      },
    };
  };

  const result = await invokeOpenRouter({
    model: "example/vision",
    prompt: "isolated prompt",
    images: [{ mimeType: "image/png", data: Buffer.from([1, 2, 3]) }],
    env: { OPENROUTER_API_KEY: "test-only-token" },
    fetchImpl,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(request.options.body);
  assert.equal(body.messages[0].content[0].text, "isolated prompt");
  assert.equal(body.messages[0].content.length, 2);
  assert.ok(!request.options.body.includes("ground-truth"));
});

test("Gemini adapter sends inline image data and parses JSON output", async () => {
  let request;
  const result = await invokeGemini({
    model: "gemini-test",
    prompt: "isolated prompt",
    images: [{ mimeType: "image/png", data: Buffer.from([4, 5]) }],
    env: { GEMINI_API_KEY: "test-only-token" },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return {
            candidates: [{ content: { parts: [{ text: '{"errors":[]}' }] } }],
          };
        },
      };
    },
  });

  assert.deepEqual(result.errors, []);
  assert.match(request.url, /gemini-test:generateContent/);
  const body = JSON.parse(request.options.body);
  assert.equal(
    body.contents[0].parts[1].inline_data.data,
    Buffer.from([4, 5]).toString("base64"),
  );
});

test("Cloudflare adapter sends a single raster page and parses JSON output", async () => {
  let request;
  const result = await invokeCloudflare({
    model: "@cf/meta/test-vision",
    prompt: "isolated prompt",
    images: [{ mimeType: "image/png", data: Buffer.from([6, 7]) }],
    env: {
      CLOUDFLARE_API_TOKEN: "test-only-token",
      CLOUDFLARE_ACCOUNT_ID: "test-account",
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: { errors: [] } } }],
          };
        },
      };
    },
  });

  assert.deepEqual(result.errors, []);
  assert.match(request.url, /test-account\/ai\/v1\/chat\/completions$/);
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "@cf/meta/test-vision");
  assert.equal(body.messages[0].role, "user");
  assert.equal(body.messages[0].content, "isolated prompt");
  assert.deepEqual(body.image, [6, 7]);
  assert.equal(body.temperature, 0);
  assert.equal(body.max_tokens, 4096);
});

test("model runner writes predictions without reading ground truth", async () => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "lexipath-eval-test-"),
  );
  try {
    const manifestPath = path.join(temporary, "manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify([
        {
          sampleId: "synthetic-1",
          sourceFile: "unused.png",
          taskType: "ESSAY",
        },
      ]),
    );

    await runModelEvaluation(
      {
        provider: "test",
        model: "test-model",
        runId: "isolated",
        manifest: manifestPath,
        outputRoot: temporary,
        guardrailProfile: "minimal",
        preprocess: true,
      },
      {
        loadPages: async () => [
          { mimeType: "image/png", data: Buffer.from([0]) },
        ],
        invoke: async ({ prompt }) => {
          assert.doesNotMatch(prompt, /ground-truth-vetted/);
          return {
            transcript: "synthetic",
            illegibleNote: "",
            errors: [
              {
                written: "runing",
                intended: "running",
                category: "orthographic",
                confidenceScore: 0.8,
              },
            ],
          };
        },
      },
    );

    const prediction = JSON.parse(
      await readFile(
        path.join(temporary, "isolated", "synthetic-1.json"),
        "utf8",
      ),
    );
    assert.equal(prediction.guardrails, true);
    assert.equal(prediction.guardrailProfile, "minimal");
    assert.equal(prediction.pipeline, "preprocessed-vision");
    assert.equal(prediction.errors[0].written, "runing");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("metrics preserve duplicate ground-truth error occurrences", async () => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "lexipath-metrics-test-"),
  );
  const truthDirectory = path.join(temporary, "truth");
  const predictionsDirectory = path.join(temporary, "predictions");
  try {
    await Promise.all([mkdir(truthDirectory), mkdir(predictionsDirectory)]);
    const repeated = {
      written: "say",
      intended: "said",
      category: "morphological",
    };
    await writeFile(
      path.join(truthDirectory, "sample.json"),
      JSON.stringify({ sampleId: "sample", errors: [repeated, repeated] }),
    );
    await writeFile(
      path.join(predictionsDirectory, "sample.json"),
      JSON.stringify({ sampleId: "sample", errors: [repeated] }),
    );

    const metrics = await evaluatePredictionDirectory({
      truthDirectory,
      predictionsDirectory,
    });
    assert.equal(metrics.truePositives, 1);
    assert.equal(metrics.falseNegatives, 1);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
