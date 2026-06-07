import { router } from './router/index.js';

const { createApp } = Vue;
const { createPinia } = Pinia;

const app = createApp({});
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');