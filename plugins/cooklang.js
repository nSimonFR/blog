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

  // Normalize strings for robust, cross-platform filename comparisons
  function normalizeForCompare(str) {
    return (str || "").normalize("NFC").toLowerCase();
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!imageExtensions.includes(ext)) continue;

      const fileBaseName = path.basename(file, ext);

      const normalizedBaseName = normalizeForCompare(baseName);
      const normalizedFileBaseName = normalizeForCompare(fileBaseName);

      // Check for main recipe image (case and unicode-insensitive)
      if (normalizedFileBaseName === normalizedBaseName) {
        images.main = file;
        continue;
      }

      // Check for step-specific images (baseName.stepNumber.ext)
      const stepMatch = normalizedFileBaseName.match(
        new RegExp(`^${escapeRegex(normalizedBaseName)}\\.(\\d+)$`)
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

    function isRecipeReference(name) {
      return (
        (name.startsWith("./") || name.startsWith("../")) &&
        name.endsWith(".cook")
      );
    }

    function convertRecipePathToUrl(recipePath, currentInputPath) {
      // Handle relative paths properly
      if (recipePath.startsWith("./")) {
        // Same directory reference - extract current directory from inputPath
        const currentDir = currentInputPath.split("/").slice(0, -1).join("/"); // Remove filename
        const relativePath = recipePath.replace("./", "");
        const fullPath = currentDir + "/" + relativePath;

        // Convert src/posts/recipes path to URL
        return (
          "/" +
          fullPath
            .replace("src/posts/recipes/", "posts/recipes/")
            .replace(".cook", "/")
        );
      } else if (recipePath.startsWith("../")) {
        // Parent directory reference
        const currentDirParts = currentInputPath.split("/").slice(0, -1); // Remove filename
        const pathParts = recipePath.split("/");

        // Start with current directory
        let resolvedParts = [...currentDirParts];

        // Process each part of the relative path
        for (const part of pathParts) {
          if (part === "..") {
            resolvedParts.pop(); // Go up one directory
          } else if (part !== "." && part !== "" && !part.endsWith(".cook")) {
            resolvedParts.push(part);
          } else if (part.endsWith(".cook")) {
            resolvedParts.push(part.replace(".cook", ""));
          }
        }

        // Convert to URL - replace src/posts/recipes with posts/recipes
        const fullPath = resolvedParts.join("/");
        const cleanPath = fullPath.replace(
          "src/posts/recipes",
          "posts/recipes"
        );
        return "/" + cleanPath + "/";
      }
      return recipePath;
    }

    function getStepTokenHTML(token) {
      const { quantity, units, name, value, type } = token;
      let tagContent = "";

      if (token.type == "timer") {
        tagContent = `${quantity} ${units}`;
      } else {
        tagContent = token.name || token.value;
      }

      // Check if this is a recipe reference
      if (token.type == "ingredient" && isRecipeReference(tagContent)) {
        // Extract the recipe path and create a link
        const recipePath = convertRecipePathToUrl(tagContent, inputPath);
        const recipeTitle = tagContent
          .split("/")
          .pop() // Get filename
          .replace(".cook", "") // Remove extension
          .replace(/-/g, " "); // Replace hyphens with spaces for display

        if (config.outputHtml) {
          return `<a href="${recipePath}" class="recipe-link">${recipeTitle}</a>`;
        } else {
          return `${recipeTitle}`;
        }
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

    // Auto-add cookware as tags
    cookware.forEach((cookwareItem) => {
      const cookwareTag = cookwareItem.name
        .toLowerCase()
        .trim()
        .split(" ")
        .join("-");
      // Add cookware tag if not already present
      if (!tags.includes(cookwareTag)) {
        tags.push(cookwareTag);
      }
    });

    // Auto-add ingredients as tags
    ingredients.forEach((ingredient) => {
      let ingredientName = ingredient.name;

      // Check if this is a recipe reference
      if (isRecipeReference(ingredientName)) {
        // Extract just the base filename without path and extension
        ingredientName = ingredientName
          .split("/")
          .pop() // Get the last part (filename)
          .replace(".cook", ""); // Remove .cook extension
      }

      const ingredientTag = ingredientName
        .toLowerCase()
        .trim()
        .split(" ")
        .join("-");
      // Add ingredient tag if not already present
      if (!tags.includes(ingredientTag)) {
        tags.push(ingredientTag);
      }
    });

    // Auto-add current recipe filename as tag
    const currentRecipeFilename = inputPath
      .split("/")
      .pop() // Get the filename
      .replace(".cook", "") // Remove .cook extension
      .toLowerCase()
      .trim()
      .split(" ")
      .join("-");

    // Add current recipe filename tag if not already present
    if (!tags.includes(currentRecipeFilename)) {
      tags.push(currentRecipeFilename);
    }

    const title =
      recipe.metadata?.title || inputPath.split("/").pop().replace(".cook", "");

    const subtitle = recipe.metadata?.introduction;

    const images = findRecipeImages(inputPath);

    const hasImages = images.main || Object.keys(images.steps).length > 0;
    if (hasImages && !tags.includes("photo")) {
      tags.push("photo");
    }

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
