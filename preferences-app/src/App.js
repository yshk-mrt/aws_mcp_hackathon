import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ModelViewPage from './pages/ModelViewPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/view-model" element={<ModelViewPage />} />
      </Routes>
    </Router>
  );
}

export default App; 