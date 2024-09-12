import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import compat from "eslint-plugin-compat";


export default [
  compat.configs["flat/recommended"],
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  
];