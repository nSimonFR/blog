const { DateTime } = require("luxon");
const readingTime = require("eleventy-plugin-reading-time");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const eleventyPluginCookLang = require("./plugins/cooklang.js");
const fs = require("fs");
const path = require("path");
const Image = require("@11ty/eleventy-img");

const isDev = process.env.ELEVENTY_ENV === "development";
const isProd = process.env.ELEVENTY_ENV === "production";

const manifestPath = path.resolve(
  __dirname,
  "public",
  "assets",
  "manifest.json"
);

const manifest = isDev
  ? {
      "main.js": "/assets/main.js",
      "main.css": "/assets/main.css",
    }
  : JSON.parse(fs.readFileSync(manifestPath, { encoding: "utf8" }));

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(readingTime);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(eleventyPluginCookLang, { outputHtml: true });

  // setup mermaid markdown highlighter
  const highlighter = eleventyConfig.markdownHighlighter;
  eleventyConfig.addMarkdownHighlighter((str, language) => {
    if (language === "mermaid") {
      return `<pre class="mermaid">${str}</pre>`;
    }
    return highlighter(str, language);
  });

  eleventyConfig.setDataDeepMerge(true);

  eleventyConfig.addPassthroughCopy({ "src/images": "images" });

  // Copy recipe images (jpg, jpeg, png) from recipe directories
  eleventyConfig.addPassthroughCopy("src/posts/recipes/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/posts/recipes/**/*.jpeg");
  eleventyConfig.addPassthroughCopy("src/posts/recipes/**/*.png");

  // Copy .cook files so they can be downloaded
  eleventyConfig.addPassthroughCopy("src/posts/recipes/**/*.cook");

  eleventyConfig.setBrowserSyncConfig({ files: [manifestPath] });

  // Responsive images with @11ty/eleventy-img
  async function imageShortcode(
    src,
    alt,
    sizes = "(min-width: 800px) 720px, 100vw",
    className = ""
  ) {
    if (!alt) {
      throw new Error(`Missing alt attribute for image: ${src}`);
    }

    const metadata = await Image(src, {
      widths: [320, 640, 960, 1280, 1600],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./public/images/optimized",
      urlPath: "/images/optimized",
    });

    const imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };
    if (className) imageAttributes.class = className;

    return Image.generateHTML(metadata, imageAttributes, {
      whitespaceMode: "inline",
    });
  }

  // Generic image shortcode (absolute or relative to project root)
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

  // Recipe image shortcode resolves filenames relative to current .cook file directory
  eleventyConfig.addNunjucksAsyncShortcode(
    "recipeImage",
    async function (
      fileName,
      alt,
      sizes = "(min-width: 800px) 720px, 100vw",
      className = ""
    ) {
      const currentDir = path.dirname(this.page.inputPath);
      const absoluteSrc = path.join(currentDir, fileName);
      return imageShortcode(
        absoluteSrc,
        alt,
        sizes,
        className || "recipe-image"
      );
    }
  );

  eleventyConfig.addShortcode("bundledcss", function () {
    return manifest["main.css"]
      ? `<link href="${manifest["main.css"]}" rel="stylesheet" />`
      : "";
  });

  eleventyConfig.addShortcode("bundledjs", function () {
    return manifest["main.js"]
      ? `<script src="${manifest["main.js"]}"></script>`
      : "";
  });

  eleventyConfig.addFilter("excerpt", (post) => {
    // This regex removes all HTML tags from the post content by matching anything between '<' and '>'
    const content = post.replace(/(<([^>]+)>)/gi, "");
    return content.substr(0, content.lastIndexOf(" ", 150)) + "...";
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy"
    );
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("dateToIso", (dateString) => {
    return new Date(dateString).toISOString();
  });

  eleventyConfig.addFilter("head", (array, n) => {
    if (n < 0) {
      return array.slice(n);
    }

    return array.slice(0, n);
  });

  eleventyConfig.addCollection("tagList", function (collection) {
    let tagSet = new Set();
    collection.getAll().forEach(function (item) {
      if ("tags" in item.data) {
        let tags = item.data.tags;

        tags = tags.filter(function (item) {
          switch (item) {
            case "all":
            case "nav":
            case "post":
            case "posts":
              return false;
          }

          return true;
        });

        for (const tag of tags) {
          tagSet.add(tag);
        }
      }
    });

    return [...tagSet];
  });

  eleventyConfig.addFilter("pageTags", (tags) => {
    const generalTags = ["all", "nav", "post", "posts"];

    return tags
      .toString()
      .split(",")
      .filter((tag) => {
        return !generalTags.includes(tag);
      });
  });

  eleventyConfig.addFilter("encodeSpaces", function (url) {
    if (!url) return url;
    return url.replace(/ /g, "%20");
  });

  return {
    dir: {
      input: "src",
      output: "public",
      includes: "includes",
      data: "data",
      layouts: "layouts",
    },
    passthroughFileCopy: true,
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
