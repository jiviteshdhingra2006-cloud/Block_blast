import React, { useState, useRef, useEffect } from 'react';
import { useGame } from './hooks/useGame';
import Auth from './Auth';
import './index.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingAuth(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser({ username: userData.username, highScore: userData.highScore });
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loadingAuth) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;
  }

  if (!user) {
    return <Auth onLogin={(userData) => setUser(userData)} />;
  }

  return <Game user={user} onLogout={handleLogout} setUser={setUser} />;
}

// Separate Game component to keep logic clean
function Game({ user, onLogout, setUser }) {
  const { grid, pieces, score, gameOver, placePiece, startGame } = useGame();
  
  const [draggingPiece, setDraggingPiece] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const boardRef = useRef(null);

  const [leaderboard, setLeaderboard] = useState([]);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Submit score automatically when game is over
  useEffect(() => {
    if (gameOver && score > 0 && !scoreSubmitted) {
      submitScore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  };

  const submitScore = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/scores`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score })
      });
      if (res.ok) {
        const data = await res.json();
        setScoreSubmitted(true);
        fetchLeaderboard();
        // Update local user state if high score changed
        if (data.highScore > user.highScore) {
          setUser(prev => ({ ...prev, highScore: data.highScore }));
        }
      }
    } catch (err) {
      console.error("Failed to submit score:", err);
    }
  };

  const handleRestart = () => {
    setScoreSubmitted(false);
    startGame();
  };

  const handlePointerDown = (e, index) => {
    if (!pieces[index] || gameOver) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggingPiece({
      index,
      piece: pieces[index],
      offsetX,
      offsetY,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!draggingPiece) return;

      // Update position directly in the DOM to avoid slow React re-renders
      const el = document.getElementById('dragging-piece');
      if (el) {
        el.style.left = `${e.clientX - draggingPiece.offsetX}px`;
        el.style.top = `${e.clientY - draggingPiece.offsetY}px`;
      }

      const blockElements = document.elementsFromPoint(e.clientX, e.clientY);
      const cellElement = blockElements.find(el => el.hasAttribute('data-row') && el.hasAttribute('data-col'));

      if (cellElement) {
        const row = parseInt(cellElement.getAttribute('data-row'), 10);
        const col = parseInt(cellElement.getAttribute('data-col'), 10);
        setHoveredCell(prev => (prev?.row === row && prev?.col === col) ? prev : { row, col });
      } else {
        setHoveredCell(prev => prev === null ? null : null);
      }
    };

    const handlePointerUp = () => {
      if (!draggingPiece) return;
      if (hoveredCell) {
        placePiece(draggingPiece.index, hoveredCell.row, hoveredCell.col);
      }
      setDraggingPiece(null);
      setHoveredCell(null);
    };

    if (draggingPiece) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingPiece, hoveredCell, placePiece]);

  const renderPiece = (piece, isDragging = false) => {
    if (!piece) return null;
    return (
      <div 
        className="piece-preview" 
        style={{ 
          gridTemplateColumns: `repeat(${piece.shape[0].length}, min(35px, 8vw))`,
          gridTemplateRows: `repeat(${piece.shape.length}, min(35px, 8vw))`,
          transform: isDragging ? 'scale(1.3)' : 'scale(0.85)',
          transition: isDragging ? 'none' : 'transform 0.2s',
          opacity: isDragging ? 0.8 : 1
        }}
      >
        {piece.shape.map((row, rIdx) => 
          row.map((cell, cIdx) => (
            <div 
              key={`${rIdx}-${cIdx}`}
              className="piece-block"
              style={{
                backgroundColor: cell ? piece.color : 'transparent',
                borderColor: cell ? 'rgba(255,255,255,0.3)' : 'transparent',
                boxShadow: cell ? undefined : 'none'
              }}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="main-layout">
      <div className="app-container" style={{ margin: 0, padding: 0 }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 10px', color: '#94a3b8' }}>
        <span>Player: <strong style={{color: 'white'}}>{user.username}</strong></span>
        <span onClick={onLogout} style={{ cursor: 'pointer', color: '#f87171' }}>Logout</span>
      </div>

      <div className="header glass-panel">
        <div className="score-box">
          <span className="score-label">Score</span>
          <span className="score-value">{score}</span>
        </div>
        <div className="score-box" style={{opacity: 0.7}}>
          <span className="score-label">Your Best</span>
          <span className="score-value" style={{fontSize: '1.5rem', color: '#cbd5e1', background: 'none', WebkitTextFillColor: 'initial'}}>
            {user.highScore}
          </span>
        </div>
      </div>

      <div className="board-container glass-panel" ref={boardRef}>
        <div className="grid">
          {grid.map((row, r) => 
            row.map((cellColor, c) => {
              let isHoverTarget = false;
              if (draggingPiece && hoveredCell) {
                const pRow = r - hoveredCell.row;
                const pCol = c - hoveredCell.col;
                if (
                  pRow >= 0 && pRow < draggingPiece.piece.shape.length &&
                  pCol >= 0 && pCol < draggingPiece.piece.shape[0].length &&
                  draggingPiece.piece.shape[pRow][pCol] === 1
                ) {
                  isHoverTarget = true;
                }
              }

              return (
                <div 
                  key={`${r}-${c}`}
                  data-row={r}
                  data-col={c}
                  className={`cell ${cellColor ? 'filled' : ''} ${isHoverTarget ? 'hovered' : ''}`}
                  style={{
                    backgroundColor: cellColor || undefined,
                    boxShadow: cellColor ? `inset 0 0 10px rgba(0,0,0,0.2)` : undefined
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      <div className="pieces-tray glass-panel">
        {pieces.map((piece, index) => (
          <div 
            key={index}
            className="piece-container"
            onPointerDown={(e) => handlePointerDown(e, index)}
            style={{ opacity: draggingPiece?.index === index ? 0 : 1 }}
          >
            {renderPiece(piece)}
          </div>
        ))}
      </div>

      {draggingPiece && (
        <div 
          id="dragging-piece"
          style={{
            position: 'fixed',
            left: draggingPiece.startX - draggingPiece.offsetX,
            top: draggingPiece.startY - draggingPiece.offsetY,
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          {renderPiece(draggingPiece.piece, true)}
        </div>
      )}

      {gameOver && (
        <div className="overlay">
          <div className="modal glass-panel" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Game Over</h2>
            <p style={{marginBottom: '15px'}}>You scored <span style={{fontWeight: 'bold', color: 'white'}}>{score}</span> points!</p>
            
            {scoreSubmitted && (
              <p style={{ color: '#10b981', marginBottom: '20px', fontWeight: 'bold' }}>Score Saved to Leaderboard!</p>
            )}

            {leaderboard.length > 0 && (
              <div style={{ marginBottom: '20px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
                <h3 style={{ marginBottom: '10px', fontSize: '1.2rem', textAlign: 'center' }}>Global Top 10</h3>
                {leaderboard.map((entry, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>{idx + 1}. {entry.playerName}</span>
                    <span style={{ fontWeight: 'bold', color: entry.playerName === user.username ? '#60a5fa' : 'white' }}>{entry.score}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn" onClick={handleRestart}>Play Again</button>
          </div>
        </div>
      )}
      </div>

      <div className="leaderboard-sidebar glass-panel">
        <h2 style={{ textAlign: 'center', marginBottom: '10px', color: '#60a5fa', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>Top 5 Players</h2>
        {leaderboard.slice(0, 5).map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: entry.playerName === user.username ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: entry.playerName === user.username ? '#60a5fa' : '#cbd5e1' }}>{idx + 1}. {entry.playerName}</span>
            <span style={{ fontWeight: 'bold', color: 'white' }}>{entry.score}</span>
          </div>
        ))}
        {leaderboard.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
      </div>
    </div >
      
  );
}

export default App;
