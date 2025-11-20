import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "@/lib/router";
import "@/assets/styles.css";
import "pdfjs-dist/web/pdf_viewer.css";
import Root from "@/Root.vue";
import "@/lib/recents";

import { setupGlobalHandlers } from "@/lib/events";
import { useAppStore } from "@/stores/appStore";

const app = createApp(Root);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialize global event handlers
setupGlobalHandlers(router, useAppStore());

app.mount("#app");
