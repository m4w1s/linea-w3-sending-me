export default {
  // Chain RPC
  rpcUrl: 'https://linea.decubate.com',
  // Задержка между транзакциями (в секундах)
  delay: {
    min: 150,
    max: 300,
  },
  // Количество потоков (сколько кошельков будут паралельно минтить NFT)
  concurrency: 2,
  // Перемешать кошельки
  shuffleWallets: true,
};
