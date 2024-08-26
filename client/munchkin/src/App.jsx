import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState(null);
  const [level, setLevel] = useState(1);
  const [gear, setGear] = useState(1);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [players, setPlayers] = useState({});
  const [roomFull, setRoomFull] = useState(false);
  const [left, setLeft] = useState(false)
  const [connected, setConnected] =useState(false)

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io.connect("http://localhost:3001");
    setSocket(socketInstance);

    // Clean up socket connection on component unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket) {
      // Handle receiving changes
      const handleReceiveChanges = ({ name, level, gear }) => {
        setPlayers(prevPlayers => ({
          ...prevPlayers,
          [name]: { level, gear }
        }));
        console.log(`Received changes: ${name} - level: ${level}, gear: ${gear}`);
      };

      // Handle receiving initial data
      const handleInitialData = (existingPlayers) => {
        const updatedPlayers = {};
        existingPlayers.forEach(({ name, level, gear }) => {
          updatedPlayers[name] = { level, gear };
        });
        setPlayers(updatedPlayers);
      };

      // Handle room full
      const handleRoomFull = () => {
        setRoomFull(true);
      };

      // Listen for changes, initial data, and room full notifications
      socket.on('receive_changes', handleReceiveChanges);
      socket.on('initial_data', handleInitialData);
      socket.on('room_full', handleRoomFull);

      // Clean up listeners on component unmount or socket change
      return () => {
        socket.off('receive_changes', handleReceiveChanges);
        socket.off('initial_data', handleInitialData);
        socket.off('room_full', handleRoomFull);
      };
    }
  }, [socket]);

  const joinRoom = useCallback(() => {
    if (room && name) {
      socket.emit('join_room', { room, name, level, gear });
    }
  }, [room, name, level, gear, socket]);

  const leaveRoom = () => {
    socket.emit('leave_room', { room, name });
  };

  const sendChanges = useCallback(() => {
    if (socket) {
      socket.emit('send_changes', { level, gear, room, name });
    }
  }, [socket, room, name, level, gear]);

  useEffect(() => {
    sendChanges(); // Call sendChanges when level or gear changes
  }, [level, gear, sendChanges]);

  const incrementLevel = () => {
    setLevel(prevLevel => {
      const newLevel = Math.max(prevLevel + 1, 1); // Prevent level from going below 1
      return newLevel;
    });
  };

  const decrementLevel = () => {
    setLevel(prevLevel => {
      const newLevel = Math.max(prevLevel - 1, 1); // Prevent level from going below 1
      return newLevel;
    });
  };

  const incrementGear = () => {
    setGear(prevGear => {
      const newGear = Math.max(prevGear + 1, 1); // Prevent gear from going below 1
      return newGear;
    });
  };

  const decrementGear = () => {
    setGear(prevGear => {
      const newGear = Math.max(prevGear - 1, 1); // Prevent gear from going below 1
      return newGear;
    });
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Room..."
        value={room}
        onChange={(e) => setRoom(e.target.value)}
      />
      <input
        type="text"
        placeholder="Name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={() => {setLeft(false), setConnected(true), joinRoom()}} disabled={roomFull || connected}>Connect to room</button>
      <button onClick={() => {setLeft(true), setConnected(false), leaveRoom()}}>Leave room</button>
      {roomFull && <p>Room is full. Cannot join.</p>}
      <br />
      <button onClick={incrementLevel}>Level up</button>
      <button onClick={decrementLevel}>Level down</button>
      <br />
      <button onClick={incrementGear}>Increase Gear</button>
      <button onClick={decrementGear}>Decrease Gear</button>
      <br />
      <h3><b>My stats: Level - {level}, Gear - {gear}</b></h3>
      <h3>Player Stats:</h3>
      {Object.entries(players).map(([playerName, { level, gear }]) => (
      <div key={playerName}>
        {playerName === name || left ? (
          <></>
        ) : (
          <>Player {playerName} - Level: {level}, Gear: {gear}</>
        )}
      </div>
))}

    </div>
  );
}

export default App;
