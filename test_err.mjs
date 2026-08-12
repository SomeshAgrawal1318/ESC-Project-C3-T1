
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { filterCandidateResources, recommendationEngine, parseKnowledgeDocumentMetadata, AzureKnowledgeSource } from './server/services/recommendationEngine.js';

const vaultRoot = path.resolve(
  process.env.KNOWLEDGE_VAULT_PATH ?? path.join(os.homedir(), 'KnowledgeVault')
);
const corpusRoot = path.join(vaultRoot, '_deploy', 'azure-knowledge-vault');

async function loadDocuments() {
  const wikiRoot = path.join(corpusRoot, 'wiki');
  const entries = await readdir(wikiRoot, { recursive: true, withFileTypes: true });
  const markdownPaths = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => path.join(entry.parentPath, entry.name));

  return Promise.all(
    markdownPaths.map(async (filePath) => {
      const blobPath = path.relative(corpusRoot, filePath).split(path.sep).join('/');
      const content = await readFile(filePath, 'utf8');
      return { blobPath, content, searchText: `${blobPath} ${content}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() };
    })
  );
}

const queries = JSON.parse(process.argv[2]);

async function run() {
  const documents = await loadDocuments();
  recommendationEngine.useMocks = false;
  
  const query = queries.find(q => q.queryId === "sequencing-example-pair");
  
  const candidates = filterCandidateResources(documents, query.input, 15);
  
  recommendationEngine.worksheetSections = async () => {
      return candidates.map(c => ({
          worksheetId: c.metadata.resourceId || c.blobPath,
          title: c.metadata.title,
          pageStart: 1,
          pageEnd: 3,
          targetCategories: c.metadata.addressesErrorTypes || ["unsure"],
          pdfPath: c.blobPath,
          available: true
      }));
  };
  
  recommendationEngine.knowledgeSource = {
      async contextFor(input) {
          const az = new AzureKnowledgeSource();
          az.documents = async () => documents;
          return az.contextFor(input);
      }
  };
  
  try {
      const worksheets = await recommendationEngine.findWorksheets(query.input, 3);
      console.log(worksheets);
  } catch (e) {
      console.error(e.stack);
  }
}

run().catch(console.error);
