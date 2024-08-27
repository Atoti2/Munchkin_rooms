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
  const SOCKET_URL = "https://munchkin.onrender.com"

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
    setGear(prevGear => Math.max(prevGear - 1, 0)); // Prevent gear from going below 1
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
    <div className='bg-zinc-800 min-h-screen  m-auto p-5 font-mono text-slate-100'>
      <div className='flex gap-5 flex-wrap mb-5'>
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
      </div>
      <div className='gap-5 flex'>
        <button className='text-green-600 font-semibold text-lg disabled:text-gray-500' onClick={() => { joinRoom(); setLeft(false) }} disabled={roomFull || connected}>Connect to room</button>
        <button className='text-red-600 font-semibold text-lg disabled:text-gray-500' onClick={() => { leaveRoom(); setLeft(true) }} disabled={!connected}>Leave room</button>
      </div>
      {roomFull && <p>Room is full. Cannot join.</p>}
      <br />
      <div className={!connected ? 'hidden' : 'block'}>
   
        <div>
          <p className=' text-lg font-bold text-violet-500'>Level: <span className='text-slate-100'>{level}</span></p>
        
          <div className='flex gap-5 ml-3 font-semibold'>
            <button className='bg-violet-500 text-slate-100 p-2 rounded-lg' onClick={incrementLevel}>Level up</button>
            <button className="bg-violet-500 text-slate-100 p-2 rounded-lg" onClick={decrementLevel}>Level down</button>
          </div>
        </div>
        <br />
        <div>
        <p className=' text-lg font-bold text-violet-500'>  Gear: <span className='text-slate-100'>{gear}</span></p>
        <div className='flex gap-5 ml-3 font-semibold'>
          <button className='bg-violet-500 text-slate-100 p-2 rounded-lg' onClick={incrementGear}>Increase Gear</button>
          <button className='bg-violet-500 text-slate-100 p-2 rounded-lg' onClick={decrementGear}>Decrease Gear</button>
        </div>
        </div>
        <p className='text-xl font-bold text-violet-500 mt-5'>Power: <span className='text-slate-100'>{gear + level}</span></p>
      </div>
      <br />
      <div className='flex flex-wrap gap-8 '>
  {Object.entries(players).map(([playerName, { level, gear }]) => (
    <div key={playerName} className='w-full sm:w-auto'>
      {playerName === name || left ? null : (
        <div className='bg-rose-700 w-full sm:w-fit p-8 rounded-lg'>
          <h3 className='font-bold text-3xl'>{playerName}</h3>
          <div className='flex justify-center items-center flex-col'>
            <p className='italic text-lg font-bold'>Level: {level}</p>
            <p className='italic text-lg font-bold'>Gear: {gear}</p>
            <p className='italic text-lg font-bold'>Power: {level + gear}</p>
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
