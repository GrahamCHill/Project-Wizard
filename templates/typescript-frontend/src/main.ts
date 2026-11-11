const counter = document.querySelector<HTMLButtonElement>('#counter');
let count = 0;

counter?.addEventListener('click', () => {
  count += 1;
  counter.textContent = 'Count: ' + count;
});
