const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://foxnews.fpt.vn/';

async function fetchPage(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching the URL: ${error}`);
        throw error;
    }
}

function parseHTML(html) {
    return cheerio.load(html);
}

function extractNewsItems($) {
    const newsItems = [];
    $('#tdi_171').children().each((index, element) => {
        const $element = $(element);
        if ($element.hasClass('tdb_module_loop td_module_wrap td-animation-stack td-meta-info-hide')) {
            newsItems.push({
                href: $element.find('.td-module-thumb a').attr('href'),
                dataImgUrl: $element.find('.td-module-thumb .entry-thumb').attr('data-img-url'),
                title: $element.find('.td-module-thumb a').attr('title')
            });
        }
    });
    return newsItems;
}

async function fetchNewsItemDetails(href, title) {
    const pageHtml = await fetchPage(href);
    const $ = parseHTML(pageHtml);
    const dateNode = $("time.entry-date.updated.td-module-date");
    const publishedAt = dateNode.attr('datetime') || null;
    const article = $("div.td_block_wrap.tdb_single_content.tdi_102.td-pb-border-top.td_block_template_1.td-post-content.tagdiv-type div.tdb-block-inner.td-fix-index");
    const paragraphs = [`# ${title}`];

    article.find('p, figure').each((index, element) => {
        const $element = $(element);
        let text = $element.text().trim();

        // Check for bold text
        if ($element.find('strong, b').length > 0) {
            text = `**${text}**`;
        }

        // Check for italic text
        if ($element.find('em, i').length > 0) {
            text = `*${text}*`;
        }

        // Check for images inside figure
        if ($element.is('figure')) {
            const img = $element.find('img');
            const figcaption = $element.find('figcaption span');
            const imgSrc = img.attr('src');
            const caption = figcaption.text().trim();
            if (imgSrc) {
                text = `![${caption}](${imgSrc})`;
            }
        }

        if (text && text !== '&nbsp;') {
            paragraphs.push(text);
        }
    });

    return {
        publishedAt,
        summary: paragraphs.length > 1 ? paragraphs[1] : '',
        markdownContent: paragraphs.join('\n\n')
    };
}

async function main() {
    try {
        const html = await fetchPage(url);
        const $ = parseHTML(html);
        const newsItems = extractNewsItems($);
        const promises = newsItems.map(async item => {
            const details = await fetchNewsItemDetails(item.href, item.title);
            return {
                title: item.title,
                url: item.href,
                thumbnail: item.dataImgUrl,
                published_at: details.publishedAt,
                content: details.markdownContent,
                summary: details.summary
            };
        });

        const results = await Promise.all(promises);
        console.log(results);
    } catch (error) {
        console.error(`Error: ${error}`);
    }
}

main().then(r => console.log('Done'));