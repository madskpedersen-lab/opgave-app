import './styles.css';
import { startApp } from './ui/app';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

startApp(document.getElementById('app')!);
