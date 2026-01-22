// AI Content Analysis Prompts

export const CONTENT_ANALYSIS_SYSTEM = `You are an expert SEO analyst with deep knowledge of search engine algorithms, content quality signals, and Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) guidelines.

Your task is to analyze webpage content and provide actionable SEO insights. Be specific, practical, and data-driven in your analysis.

Always respond with valid JSON matching the specified schema.`;

export const CONTENT_ANALYSIS_USER = (context: {
  url: string;
  title?: string;
  h1?: string;
  metaDescription?: string;
  textContent: string;
  wordCount: number;
  headings?: { level: number; text: string }[];
}) => `Analyze this webpage content for SEO quality:

<webpage>
URL: ${context.url}
Title: ${context.title || 'Not found'}
H1: ${context.h1 || 'Not found'}
Meta Description: ${context.metaDescription || 'Not found'}
Word Count: ${context.wordCount}
Headings: ${JSON.stringify(context.headings || [])}

Content (first 5000 chars):
${context.textContent.substring(0, 5000)}
</webpage>

Analyze this content and return JSON with this exact structure:
{
  "overallScore": <0-100 integer>,
  "searchIntentMatch": <0-100 integer - how well content satisfies likely search intent>,
  "contentDepth": "<shallow|moderate|comprehensive>",
  "keywordNaturalness": <0-100 integer - 100 = perfectly natural, 0 = keyword stuffed>,
  "eeatSignals": {
    "experience": [<strings describing first-hand experience indicators found>],
    "expertise": [<strings describing expertise signals like credentials, depth of knowledge>],
    "authority": [<strings describing authority signals like citations, references>],
    "trust": [<strings describing trust signals like contact info, transparency>]
  },
  "improvements": [
    {
      "priority": <1-5 integer, 1 = highest>,
      "suggestion": "<specific actionable improvement>",
      "impact": "<expected SEO impact of this change>"
    }
  ],
  "uniqueValue": "<one sentence describing what unique value this page provides>",
  "missingTopics": [<topics that comprehensive coverage should include>],
  "targetKeyword": "<the primary keyword this page appears to target>",
  "keywordDensity": <percentage as decimal, e.g., 2.5>
}

Be critical but constructive. Focus on high-impact improvements.`;

export const META_ANALYSIS_SYSTEM = `You are an expert SEO copywriter specializing in meta tags that drive clicks from search results.

You understand:
- Google's SERP display rules (title ~60 chars, description ~155 chars)
- Click psychology and emotional triggers
- Keyword optimization without stuffing
- Brand positioning in titles

Always respond with valid JSON matching the specified schema.`;

export const META_ANALYSIS_USER = (context: {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  pageType?: string;
  industry?: string;
}) => `Analyze these meta tags and suggest improvements:

<page>
URL: ${context.url}
Current Title: ${context.title || 'Missing'}
Current Description: ${context.metaDescription || 'Missing'}
H1: ${context.h1 || 'Not found'}
Page Type: ${context.pageType || 'Unknown'}
Industry: ${context.industry || 'General'}
</page>

Return JSON with this exact structure:
{
  "titleAnalysis": {
    "effectiveness": <0-100 integer>,
    "clickPotential": <0-100 integer>,
    "keywordPlacement": "<optimal|suboptimal|missing>",
    "emotionalTriggers": [<power words or emotional triggers found>],
    "suggestions": [<3-5 alternative title suggestions that would perform better>]
  },
  "descriptionAnalysis": {
    "effectiveness": <0-100 integer>,
    "hasCallToAction": <boolean>,
    "hasUniqueSellingProposition": <boolean>,
    "keywordNaturalness": <0-100 integer>,
    "suggestions": [<3-5 alternative description suggestions>]
  },
  "serpPrediction": {
    "predictedCTR": <predicted click-through rate as percentage, e.g., 3.5>,
    "competitiveStrength": "<weak|average|strong>",
    "improvements": [<specific changes that would improve CTR>]
  }
}

Make suggestions compelling, keyword-optimized, and within character limits.`;

export const SCHEMA_ANALYSIS_SYSTEM = `You are an expert in structured data and Schema.org markup for SEO.

You understand:
- All Schema.org types and their properties
- Google's rich result requirements
- JSON-LD best practices
- How to maximize rich snippet eligibility

Always respond with valid JSON matching the specified schema.`;

export const SCHEMA_ANALYSIS_USER = (context: {
  url: string;
  title?: string;
  textContent: string;
  existingSchema?: object[];
  pageType?: string;
}) => `Analyze this page and recommend structured data:

<page>
URL: ${context.url}
Title: ${context.title || 'Unknown'}
Detected Page Type: ${context.pageType || 'Unknown'}
Existing Schema: ${JSON.stringify(context.existingSchema || [], null, 2)}

Content Summary (first 2000 chars):
${context.textContent.substring(0, 2000)}
</page>

Return JSON with this exact structure:
{
  "detectedPageType": "<article|product|service|faq|how-to|local-business|organization|person|event|recipe|other>",
  "recommendedSchemas": [
    {
      "type": "<Schema.org type name>",
      "priority": "<critical|high|medium|low>",
      "reason": "<why this schema is recommended>"
    }
  ],
  "generatedSchemas": [
    {
      "type": "<Schema.org type>",
      "jsonLd": <complete valid JSON-LD object>,
      "explanation": "<what this schema does and why>"
    }
  ],
  "richSnippetPotential": [
    {
      "type": "<rich result type: FAQ, How-to, Review, Product, etc.>",
      "eligible": <boolean>,
      "requirements": [<what's needed to qualify>]
    }
  ]
}

Generate complete, valid JSON-LD that can be directly used.`;

export const AI_VISIBILITY_SYSTEM = `You are an expert in how AI systems (LLMs like ChatGPT, Claude, Perplexity) crawl, understand, and cite web content.

You understand:
- How LLMs parse and understand content structure
- The llms.txt standard for AI guidance
- When to allow/block AI crawlers
- How to optimize for AI citation

Always respond with valid JSON matching the specified schema.`;

export const AI_VISIBILITY_USER = (context: {
  url: string;
  title?: string;
  textContent: string;
  headings?: { level: number; text: string }[];
  hasLlmsTxt: boolean;
  llmsTxtContent?: string;
  blockedBots: string[];
}) => `Analyze this page's AI/LLM visibility:

<page>
URL: ${context.url}
Title: ${context.title || 'Unknown'}
Has llms.txt: ${context.hasLlmsTxt}
llms.txt content: ${context.llmsTxtContent || 'N/A'}
Blocked AI Bots: ${context.blockedBots.join(', ') || 'None'}

Heading Structure:
${(context.headings || []).map(h => '  '.repeat(h.level - 1) + h.text).join('\n')}

Content (first 3000 chars):
${context.textContent.substring(0, 3000)}
</page>

Return JSON with this exact structure:
{
  "llmReadability": {
    "score": <0-100 integer>,
    "structureClarity": <0-100 integer - how clear is the content structure>,
    "contextClarity": <0-100 integer - how clear is the page's purpose/topic>,
    "citationPotential": <0-100 integer - likelihood of being cited by AI>,
    "improvements": [<specific improvements for AI readability>]
  },
  "botAccessRecommendation": {
    "shouldAllowGPTBot": <boolean>,
    "shouldAllowClaudeBot": <boolean>,
    "shouldAllowPerplexityBot": <boolean>,
    "shouldAllowGoogleExtended": <boolean>,
    "rationale": "<explanation of bot access recommendation>"
  },
  "llmsTxtSuggestion": {
    "content": "<suggested llms.txt content>",
    "explanation": "<why this llms.txt is recommended>"
  }
}

Consider the site's likely goals when recommending bot access.`;

export const FIX_PRIORITIZATION_SYSTEM = `You are an SEO strategist who excels at prioritizing fixes for maximum impact with minimum effort.

You understand:
- Which SEO issues have the biggest ranking impact
- Implementation effort for different types of fixes
- How to batch related fixes together
- Quick wins vs long-term improvements

Always respond with valid JSON matching the specified schema.`;

export const FIX_PRIORITIZATION_USER = (context: {
  issues: { code: string; severity: string; title: string; category: string }[];
  url: string;
  framework?: string;
}) => `Prioritize these SEO issues by impact and effort:

<context>
URL: ${context.url}
Framework: ${context.framework || 'Unknown'}
</context>

<issues>
${context.issues.map(i => `- [${i.severity.toUpperCase()}] ${i.code}: ${i.title} (${i.category})`).join('\n')}
</issues>

Return JSON with this exact structure:
{
  "prioritizedIssues": [
    {
      "issueCode": "<issue code>",
      "impactScore": <0-100 integer - SEO impact if fixed>,
      "effortScore": <0-100 integer - effort to fix, 100 = very hard>,
      "roiScore": <calculated as impact / effort, higher is better>,
      "rationale": "<why this priority>"
    }
  ],
  "fixBatches": [
    {
      "batch": <1, 2, 3, etc.>,
      "theme": "<batch theme like 'Meta Tags' or 'Technical SEO'>",
      "estimatedImpact": "<description of combined impact>",
      "issueCodes": [<issue codes in this batch>]
    }
  ]
}

Sort prioritizedIssues by roiScore descending. Group related fixes into batches.`;
