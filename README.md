## Eleventy Blog adapted for Recipes (Cooklang powered)

This project is an Eleventy (11ty) site customized to publish both classic blog posts and structured recipes written in Cooklang. It includes smart tag generation, image conventions for recipes, download links for `.cook` files.

### Key features

- **Eleventy base**: Content site built with Eleventy (11ty) and the "Eleventy Duo" theme.
- **Cooklang recipes**: Local plugin built on `@cooklang/cooklang-ts` parses `.cook` files into structured data available to templates.
- **Smart tags (auto-generated)**:
  - Folder/category tag from the parent directory of the recipe (e.g. `Gateaux`, `Plats`).
  - One tag per cookware item.
  - One tag per ingredient (normalized, kebab-cased).
  - A tag for the current recipe filename.
  - `photo` tag added automatically when an image is present.
  - Metadata tags from the recipe (if provided) are preserved.
- **Recipe references**: If an ingredient is a relative path to another `.cook` file (e.g. `./My Base.cook`), it is rendered as a link to that recipe.
- **Image conventions**:
  - Main image: same basename as the `.cook` file (e.g. `Recipe.jpeg`).
  - Step images: `Recipe.1.jpeg`, `Recipe.2.jpeg`, ... are shown next to the corresponding instruction step.
- **Recipe UX**:
  - Download button for the original `.cook` file.
  - Prep and cook times displayed from metadata (`time.prep`, `time.cook`).
- **Tags pages**: Global tag list shows only tags used by 2+ items; per-page tag rendering hides Eleventy-internal tags.
- **Content extras**: RSS feed, syntax highlighting, Mermaid diagrams support, reading-time for posts.
- **Assets**: Webpack + PostCSS pipeline with manifest injection and BrowserSync reload during development.

### Project structure

- `src/posts/blog/` — Regular blog posts (uses layout `post`).
- `src/posts/recipes/` — Recipe content organized by French categories (`Gateaux`, `Plats`, `Apero`, ...), each recipe as a `.cook` file (uses layout `recipe`).
- `plugins/cooklang.js` — Local Eleventy extension providing Cooklang parsing and the smart tagging/image logic.
- `src/layouts/` — Nunjucks layouts (`base.njk`, `post.njk`, `recipe.njk`).
- `src/includes/` — Reusable components (tags list, posts list).
- `webpack.config.js`, `postcss.config.js` — Asset pipeline configuration.

### Content authoring

#### Blog posts

- Create Markdown files under `src/posts/blog/`.
- They use the `post` layout and typically carry tags like `blog` and a language tag (e.g. `lang:en`).

#### Recipes (Cooklang)

- Create `.cook` files under `src/posts/recipes/<Category>/` (e.g. `src/posts/recipes/Gateaux/Banana Cake.cook`).
- The directory `src/posts/recipes/recipes.json` sets `layout: recipe` and tags `recette`, `lang:fr` for all recipes.
- Optional images:
  - Main image: `Banana Cake.jpeg` (same basename as the recipe file) will be shown at the top.
  - Step images: `Banana Cake.1.jpeg`, `Banana Cake.2.jpeg`, etc. will be shown near corresponding steps.
- Relative ingredient links to other recipes (e.g. `./My Base.cook`) render as links to that recipe.

Metadata supported by the plugin (from Cooklang metadata):

```text
>> title: Banana Cake
>> time.prep: 15
>> time.cook: 45
>> introduction: Super moist, super easy.
>> tags: [dessert, facile]
```

### Development

Requirements: Node.js and npm.

Commands:

```bash
npm install
npm run dev      # concurrent dev server + asset watch
npm run build    # build assets and site into ./public
```

Details:

- Dev server runs Eleventy with BrowserSync. Webpack writes a manifest watched by Eleventy to inject the correct asset URLs.
- Production build hashes assets and minifies CSS/JS.
- Output directory is `public/`.

### Configuration

- Global site data: `src/data/site.json` (name, URLs, social links, header links including the `recette` tag).
- Eleventy config: `.eleventy.js` (filters, collections, shortcodes, passthrough copies for images and `.cook` files).
- Asset bundling: `webpack.config.js` and `postcss.config.js`.

### Credits

- Built with [Eleventy](https://www.11ty.dev/) and the [Eleventy Duo](https://github.com/yinkakun/eleventy-duo) theme.
- Cooklang parsing via [`@cooklang/cooklang-ts`](https://github.com/cooklang/cooklang-ts).
- Local Cooklang Eleventy extension adapted from the original work by `matt-auckland` (MIT).

### License

MIT — see `LICENSE`.
