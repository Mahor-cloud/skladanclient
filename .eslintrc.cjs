/* eslint-env node */
module.exports = {
    root: true,
    env: {
        node: true
    },
    extends: ["plugin:vue/vue3-essential", "eslint:recommended", "@vue/eslint-config-prettier"],
    parserOptions: {
        ecmaVersion: "latest"
    },
    rules: {
        "vue/multi-word-component-names": "off",
        "vue/no-reserved-component-names": "off",
        "vue/block-order": [
            "error",
            {
                order: ["script", "template", "style"]
            }
        ]
    }
}
