import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
    // 1. Wait for Astro/Starlight to generate the full page HTML
    let response = await next();

    // Only process HTML responses in the /docs/ folder
    if (!response.headers.get('content-type')?.includes('text/html') || !context.url.pathname.startsWith('/docs')) {
        return response;
    }

    let html = await response.text();

    // 2. Extract the default title Starlight generated (e.g., "Getting Started | MockScores Documentation")
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (!titleMatch) return new Response(html, response);

    const rawTitle = titleMatch[1];

    // Extract just the page name (e.g., "Getting Started")
    const pageTitle = rawTitle.split('|')[0].trim();

    // 3. Define the new SEO-optimized title
    const isRootDocs = context.url.pathname === '/docs/' || context.url.pathname === '/docs';
    const customTitle = isRootDocs
        ? 'MockScores Documentation - Mock Trial Software'
        : `${pageTitle} - Mock Trial Software | MockScores`;

    // 4. Build the JSON-LD Schema
    // We extract the description from the meta tag
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    const description = descMatch ? descMatch[1] : 'MockScores documentation and tournament setup guide.';

    const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: customTitle,
        description: description,
        url: context.url.href,
        author: {
            '@type': 'Organization',
            name: 'MockScores',
            url: 'https://mockscores.org'
        }
    };

    const schemaScript = `<script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;

    // 5. String Replacement: Overwrite titles and inject schema
    html = html
        .replace(/<title>.*?<\/title>/gi, `<title>${customTitle}</title>`)
        .replace(/<meta\s+property=["']og:title["']\s+content=["'].*?["']\s*\/?>/gi, `<meta property="og:title" content="${customTitle}"/>`)
        .replace(/<meta\s+name=["']twitter:title["']\s+content=["'].*?["']\s*\/?>/gi, `<meta name="twitter:title" content="${customTitle}"/>`)
        .replace('</head>', `${schemaScript}\n</head>`);

    // Return the modified HTML to the browser / static builder
    return new Response(html, {
        status: 200,
        headers: response.headers
    });
});