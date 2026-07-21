import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';

/** HashRouter: tarayıcı + Electron file:// ile sorunsuz çalışır */
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  );
}
