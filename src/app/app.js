import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { Line } from 'react-chartjs-2';

const socket = io('http://localhost:3000'); // Conecta ao backend

function App() {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Ouve os dados em tempo real
    socket.on('new-data', (data) => {
      setChartData((prevData) => [...prevData, data.value]);
    });

    return () => {
      socket.off('new-data');
    };
  }, []);

  const data = {
    labels: chartData.map((_, index) => index + 1),
    datasets: [
      {
        label: 'Real-time Data',
        data: chartData,
        borderColor: 'rgba(75,192,192,1)',
        fill: false,
      },
    ],
  };

  return (
    <div>
      <h1>Real-time Chart</h1>
      <Line data={data} />
    </div>
  );
}

export default App;

app.post('/data', (req, res) => {
  const data = req.body;
  io.emit('new-data', data); // Emite o evento 'new-data' com os dados recebidos
  res.status(200).send('Data received and broadcasted');
});