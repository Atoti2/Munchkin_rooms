import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState(null);
  const [level, setLevel] = useState(1);
  const [gear, setGear] = useState(0);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [players, setPlayers] = useState({});
  const [roomFull, setRoomFull] = useState(false);
  const [left, setLeft] = useState(false);
  const [connected, setConnected] = useState(false);

  // Use environment variable for socket URL
  const SOCKET_URL = "https://munchkin.onrender.com";

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
    });
    setSocket(socketInstance);

    // Clean up socket connection on component unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [SOCKET_URL]);

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
        console.log('Received initial data:', existingPlayers);
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
    console.log(`Joining room: ${room}, name: ${name}, level: ${level}, gear: ${gear}`);
    
    if (room && name) {
      socket.emit('join_room', { room, name, level, gear });
      setConnected(true); // Mark as connected
    }
  }, [room, name, level, gear, socket]);

  const leaveRoom = () => {
    socket.emit('leave_room', { room, name });
    setLeft(true); // Mark as left
    setConnected(false); // Mark as disconnected
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
    setLevel(prevLevel => Math.max(prevLevel + 1, 1)); // Prevent level from going below 1
  };

  const decrementLevel = () => {
    setLevel(prevLevel => Math.max(prevLevel - 1, 1)); // Prevent level from going below 1
  };

  const incrementGear = () => {
    setGear(prevGear => Math.max(prevGear + 1, 1)); // Prevent gear from going below 1
  };

  const decrementGear = () => {
    setGear(prevGear => Math.max(prevGear - 1, 0)); // Prevent gear from going below 0
  };

  const handleDeath = () => {
    setLevel(level); // Optionally set level or take other actions for "death"
    setGear(0);
  };
  
  const handleReset = () => {
    setLevel(1); // Reset to starting level value
    setGear(0); // Reset to starting gear value
  };

  useEffect(() => {
    // Handle page unload event to notify server
    const handleBeforeUnload = () => {
      if (connected) {
        socket.emit('leave_room', { room, name });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (connected) {
        socket.emit('leave_room', { room, name });
      }
    };
  }, [connected, room, name, socket]);
  
  return (
    <div className='bg-zinc-800 min-h-screen m-auto p-5 font-mono text-slate-100'>
      <div className='flex gap-5 flex-wrap mb-5 '>
        <div className='flex flex-col'>
          <label className='text-lg' htmlFor="room">Room</label>
          <input
            className='rounded-lg p-3 text-xl text-slate-900'
            type="text"
            placeholder="Room number"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </div>
        <div className='flex flex-col'>
          <label className='text-lg' htmlFor="name">Name</label>
          <input
            disabled={connected}
            className='rounded-lg p-3 text-xl text-slate-900'
            type="text"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={`flex gap-4 items-center mt-0 sm:mt-[28px] ${!connected ? 'hidden' : ''}`}>
          <button 
            className="bg-red-600 active:bg-red-800 text-slate-100 p-3 text-xl rounded-lg transition-transform transform" 
            onClick={handleDeath}>
            Death
          </button>
          <button 
            className="bg-gray-600  active:bg-gray-800 text-slate-100 p-3 text-xl rounded-lg transition-transform transform" 
            onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
      <div className='gap-5 flex'>
        <button className='text-green-600 font-semibold text-lg disabled:text-gray-500' onClick={() => { joinRoom(); setLeft(false) }} disabled={roomFull || connected}>Connect to room</button>
        <button className='text-red-600 font-semibold text-lg disabled:text-gray-500' onClick={() => { leaveRoom(); setLeft(true) }} disabled={!connected}>Leave room</button>
      
      </div>
      
      {roomFull && <p>Room is full. Cannot join.</p>}
      <br />
      <div className={`transition-all duration-500 ease-in-out transform ${!connected ? 'opacity-0 scale-75' : 'opacity-100 scale-100'} bg-gradient-to-br from-blue-900 to-indigo-700 p-8 w-full md:w-1/3 lg:w-1/4 rounded-xl shadow-xl`}>
        <h1 className='font-extrabold text-4xl text-slate-100 tracking-wide text-center'>You</h1>
  
        <div className='mt-6'>
          <p className='text-lg font-bold text-violet-300 text-center'>Level</p>
          <div className='flex gap-6 font-semibold items-center justify-center'>
            <button 
              className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-slate-100 p-4 text-2xl rounded-lg transition-transform transform hover:scale-105" 
              onClick={decrementLevel}>
              -
            </button>
            <span className='text-slate-100 text-3xl'>{level}</span>
            <button 
              className='bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-slate-100 p-4 text-2xl rounded-lg transition-transform transform hover:scale-105' 
              onClick={incrementLevel}>
              +
            </button>
          </div>
        </div>

        <div className='mt-8'>
          <p className='text-lg font-bold text-violet-300 text-center'>Gear</p>
          <div className='flex gap-6 font-semibold items-center justify-center'>
            <button 
              className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-slate-100 p-4 text-2xl rounded-lg transition-transform transform hover:scale-105" 
              onClick={decrementGear}>
              -
            </button>
            <span className='text-slate-100 text-3xl'>{gear}</span>
            <button 
              className='bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-slate-100 p-4 text-2xl rounded-lg transition-transform transform hover:scale-105' 
              onClick={incrementGear}>
              +
            </button>
          </div>
        </div>

        <div className='mt-8 bg-gradient-to-r from-cyan-500 to-teal-600 p-4 rounded-lg shadow-lg transition-transform transform hover:scale-110'>
          <p className='text-2xl font-extrabold text-white text-center'>
            Power: <span className='text-slate-100'>{gear + level}</span>
          </p>
        </div>
    
      </div>

      <br />
      <div className='flex flex-wrap gap-8'>
        {Object.entries(players).map(([playerName, { level, gear }]) => (
          <div key={playerName} className='w-full sm:w-auto'>
            {playerName === name || left ? null : (
              <div className={`bg-gradient-to-br from-rose-700 to-red-600 w-full sm:w-fit p-8 rounded-xl shadow-lg transition-all duration-500 ease-in-out transform ${!connected ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
                <h3 className='font-extrabold text-4xl text-white tracking-wide text-center mb-6'>{playerName}</h3>
                
                <div className='flex justify-center items-center flex-col gap-4'>
                  <p className='italic text-lg font-bold text-rose-200 bg-rose-800 py-2 px-4 rounded-md shadow-sm w-full text-center transition-transform transform hover:scale-105'>
                    Power: <span className="text-white">{level + gear}</span>
                  </p>
                  <p className='italic text-lg font-bold text-rose-200 bg-rose-800 py-2 px-4 rounded-md shadow-sm w-full text-center transition-transform transform hover:scale-105'>
                    Level: <span className="text-white">{level}</span>
                  </p>
                  <p className='italic text-lg font-bold text-rose-200 bg-rose-800 py-2 px-4 rounded-md shadow-sm w-full text-center transition-transform transform hover:scale-105'>
                    Gear: <span className="text-white">{gear}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
