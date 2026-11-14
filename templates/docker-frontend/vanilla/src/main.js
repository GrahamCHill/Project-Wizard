import './style.css';

const root = document.querySelector('#app');
const heading = document.createElement('h1');
heading.textContent = document.title;
const button = document.createElement('button');
let count = 0;
button.textContent = 'Count 0';
button.addEventListener('click', () => { button.textContent = 'Count ' + ++count; });
root.append(heading, button);
