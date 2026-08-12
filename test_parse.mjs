
import { parseKnowledgeDocumentMetadata } from './server/services/recommendationEngine.js';

const content = `---
target_skills: ["a", "b"]
---
`;

const res = parseKnowledgeDocumentMetadata({ blobPath: 'test.md', content });
console.log(res.metadata.targetSkills);
