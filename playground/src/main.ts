import { mount } from './lib';
import './styles.css';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app')!;
  mount(app);
});
