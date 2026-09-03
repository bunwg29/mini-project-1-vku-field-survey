import { createApp } from 'vue';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import './style.css';
import App from './App.vue';

defineCustomElements(window);

createApp(App).mount('#app');