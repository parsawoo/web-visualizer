import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/theme.css';
import './styles/studio.css';
import './styles/landing.css';
import './styles/app.css';

// No StrictMode: the effects mount imperative WebGL / audio / rAF engines that
// don't tolerate dev double-invocation cleanly. Production single-mounts anyway.
ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>);
