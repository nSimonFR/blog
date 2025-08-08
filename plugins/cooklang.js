/**
 * Cooklang Plugin for Eleventy
 *
 * Original implementation from: https://github.com/matt-auckland/eleventy-plugin-cooklang
 * Author: matt-auckland
 * License: MIT
 *
 * This is a local copy to avoid external dependency while maintaining "almost" the same functionality.
 */

const { Recipe } = require("@cooklang/cooklang-ts");
const fs = require("fs");
const path = require("path");

const frontmatterRegex = /^(\-\-\-\n)(.*\n)*(\-\-\-)$/gm;
let config = {};

module.exports = function (eleventyConfig, userConfig = {}) {
  config = userConfig;
  eleventyConfig.addTemplateFormats("cook");
  eleventyConfig.addExtension("cook", cookExtension);
};

function findRecipeImages(inputPath) {
  const dir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, ".cook");
  const images = {
    main: null,
    steps: {},
  };

  // Supported image extensions
  const imageExtensions = [".jpg", ".jpeg", ".png"];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!imageExtensions.includes(ext)) continue;

      const fileBaseName = path.basename(file, ext);

      // Check for main recipe image (exact match)
      if (fileBaseName === baseName) {
        images.main = file;
        continue;
      }

      // Check for step-specific images (baseName.stepNumber.ext)
      const stepMatch = fileBaseName.match(
        new RegExp(
          `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(\\d+)$`
        )
      );
      if (stepMatch) {
        const stepNumber = parseInt(stepMatch[1]);
        images.steps[stepNumber] = file;
      }
    }
  } catch (error) {
    // Directory read error, return empty images object
    console.warn(`Could not read directory for images: ${dir}`, error.message);
  }

  return images;
}

const cookExtension = {
  getData: async function (inputPath) {
    const content = fs.readFileSync(inputPath, "utf-8");
    const charsToTrim = content.match(frontmatterRegex)?.[0]?.length;
    // Trim out frontmatter
    const trimmedString = content.substring(charsToTrim);

    // Parse recipe using cooklang-ts
    const recipe = new Recipe(trimmedString);

    let steps = [];
    let ingredients = [];
    let cookware = [];

    const metadataTags = recipe?.metadata?.tags?.replace(/^\[|\]$/g, "");
    let tags = metadataTags
      ? metadataTags.split(",").map((tag) => tag.toLowerCase().trim())
      : [];

    // Auto-add folder-based category tags
    // Extract folder name from input path
    const pathParts = inputPath.split("/");
    const folderName = pathParts[pathParts.length - 2]; // Get parent folder name

    if (folderName) {
      const categoryTag = folderName.toLowerCase();
      // Add category tag if not already present
      if (!tags.includes(categoryTag)) {
        tags.unshift(categoryTag); // Add at beginning to maintain category-first order
      }
    }

    function getStepTokenHTML(token) {
      const { quantity, units, name, value, type } = token;
      let tagContent = "";

      if (token.type == "timer") {
        tagContent = `${quantity} ${units}`;
      } else {
        tagContent = token.name || token.value;
      }

      if (config.outputHtml) {
        return `<span class="recipe--${type}">${tagContent}</span>`;
      } else {
        return `${tagContent}`;
      }
    }

    recipe.steps.forEach((stepTokens, i) => {
      if (!steps[i]) steps[i] = [];

      stepTokens.forEach((token) => {
        if (token.type == "ingredient") {
          let { name, quantity, units } = token;

          if (
            config.limitIngredientDecimals &&
            !isNaN(config.limitIngredientDecimals)
          ) {
            const decimalPlaces = parseInt(config.limitIngredientDecimals);
            // Parsing float twice removes any trailing 0s
            quantity = parseFloat(parseFloat(quantity).toFixed(decimalPlaces));
          }
          ingredients.push({ name, quantity, units });
        }

        if (token.type == "cookware") {
          const { name } = token;
          cookware.push({ name });
        }

        steps[i].push(getStepTokenHTML(token));
      });
    });

    const title =
      recipe.metadata?.title || inputPath.split("/").pop().replace(".cook", "");

    const subtitle = recipe.metadata?.introduction;

    const images = findRecipeImages(inputPath);

    return {
      recipe,
      steps,
      ingredients,
      cookware,
      title,
      subtitle,
      images,
      tags,
    };
  },
  compile: async () => {
    return async (data) => {
      return data.steps.map((step) => step.join(" ")).join("\n\n");
    };
  },
};
