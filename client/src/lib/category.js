// 5 + 1 error categorise, a fixed vocabular shared across every slice that touches DetectedError
const CATEGORY = {
    phonological: { label: 'Phonological', short: 'Phon' },
    orthographic: { label: 'Orthographic', short: 'Orth' },
    morphological: { label: 'Morphological', short: 'Morph' },
    capitalisation: { label: 'Capitalisation', short: 'Cap' },
    punctuation: { label: 'Punctuation', short: 'Punc' },
    unsure: { label: 'Unsure', short: 'Unsure' },
};

const FALLBACK = { label: 'Unsure', short: 'Unsure' };

export function categoryFor(category) {
    return CATEGORY[category] ?? FALLBACK;
}

export const CATEGORY_ORDER = [
    'phonological',
    'orthographic',
    'morphological',
    'capitalisation',
    'punctuation',
    'unsure',
];