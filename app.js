async function main() {
  const chartDataRaw = await getInitialData(0.1);
  const initialChartData = chartDataRaw.map(item => this.transformDataBinance(item));

  const options = {
    series: [{
      data: initialChartData
    }],
    chart: {
      type: 'candlestick',
      height: 350,
      animations: {
        enabled: false,
        dynamicAnimation: {
          enabled: false
        }
      }
    },
    title: {
      text: 'BTC/EUR',
      align: 'left'
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      }
    }
  };

  const chart = new ApexCharts(document.querySelector("#chart"), options);
  chart.render();

  let candlestick;
  let nextTimestamp = getNextTimestamp(initialChartData[initialChartData.length - 1].x);

  worker.onmessage = event => {
    candlestick = this.transformDataKraken(event.data);
  }

  // Set up chart update
  setInterval(() => {
    if (!candlestick) return;

    const chartData = options.series[0].data;

    if (candlestick.x < nextTimestamp) {
      // Update candlestick
      candlestick.x.setSeconds(0, 0);
      chartData[chartData.length - 1] = candlestick;
    } else {
      // Time's up, add new candlestick
      chartData.shift();
      chartData.push(candlestick);

      nextTimestamp = getNextTimestamp(nextTimestamp);
    }

    chart.updateSeries([{
      data: chartData
    }]);
  }, 1000);
}

function getNextTimestamp(now) {
  const timeNow = typeof now === 'number' ? now : now.getTime();
  const nextTimestamp = new Date(timeNow + 60 * 1000);
  return nextTimestamp.setSeconds(0, 0);
}

// Transform Binance to Apex data format
function transformDataBinance(item) {
  return {
    x: new Date(item[0]), // Timestamp
    y: [
      parseFloat(item[1]), // Open
      parseFloat(item[2]), // High
      parseFloat(item[3]), // Low
      parseFloat(item[4]), // Close
    ]
  };
}

// Transform Kraken to D3 data format
function transformDataKraken(item) {
  return {
    // x: parseFloat(item[0]) * 1000, // Timestamp
    x: new Date(parseFloat(item[0]) * 1000), // Timestamp
    y: [
      parseFloat(item[2]), // Open
      parseFloat(item[3]), // High
      parseFloat(item[4]), // Low
      parseFloat(item[5]), // Close
    ]
  }
}

// Fetch price history
async function getInitialData(numberOfDays) {
  const now = new Date().getTime();
  const offset = (24 * 60 * 60 * 1000) * numberOfDays;
  const start = new Date().setTime(now - offset);

  const url = new URL('https://api.binance.com/api/v3/klines');
  url.searchParams.append('symbol', 'BTCEUR');
  url.searchParams.append('interval', '1m');
  url.searchParams.append('startTime', start);
  url.searchParams.append('endTime', now);
  // url.searchParams.append('limit', 1000);

  const response = await fetch(url.href)
  return await response.json();
}

window.onbeforeunload = () => {
  worker.postMessage({ status: 'closing' });
}

main();

if (typeof (worker) === 'undefined') {
  worker = new Worker('WebSocketWebWorker.js');
}
