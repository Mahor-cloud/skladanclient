const { default: plugin } = require("tailwindcss")

/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution")

module.exports = {
    root: true,
    env: {
        node: true
    },
    plugins: ["@typescript-eslint"],
    extends: ["plugin:vue/vue3-essential", "eslint:recommended", "@vue/eslint-config-prettier", "plugin:@typescript-eslint/recommended"],
    parserOptions: {
        ecmaVersion: "latest"
    },
    rules: {
        "vue/multi-word-component-names": "off",
        "vue/no-reserved-component-names": "off",
        "vue/component-tags-order": [
            "error",
            {
                order: ["script", "template", "style"]
            }
        ]
    }
}
