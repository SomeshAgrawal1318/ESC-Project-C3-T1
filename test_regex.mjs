
function frontmatterBlock(content) {
  return String(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
}

const content = `---
target_skills: ["a", "b"]
---
`;

const block = frontmatterBlock(content);
console.log("BLOCK:", block);

const match = block.match(new RegExp(`^target_skills:\\s*\\[(.*?)\\]`, 'm'));
console.log("MATCH:", match);
