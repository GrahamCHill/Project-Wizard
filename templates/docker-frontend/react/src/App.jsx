import React, { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);
  return <>
    <h1>{document.title}</h1>
    <button onClick={() => setCount(value => value + 1)}>Count {count}</button>
  </>;
}
