const API_KEY = "ur2855272-4026a39e7dcc2473426b4f0c"; // Your UptimeRobot API key

function setShimmer(state) {
  // Add or remove shimmer effect on all card bodies
  document.querySelectorAll('.card-body').forEach(el => {
    if (state) el.classList.add('shimmer');
    else el.classList.remove('shimmer');
  });
}

async function fetchStatus() {
  const spinner = document.getElementById("loading-spinner");
  spinner.style.display = "flex";
  setShimmer(true);

  try {
    const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `api_key=${API_KEY}&format=json&custom_uptime_ratios=1-7-30-90&logs=1&response_times=1&response_times_limit=30`
    });

    const data = await res.json();
    if (!data.monitors || data.monitors.length === 0) throw new Error("No monitor data");
    const monitor = data.monitors[0]; // Show the first monitor for now

    // Site name, type, url, created, id
    document.getElementById("site-title").textContent = monitor.friendly_name;
    document.getElementById("site-type").textContent = monitor.type === 1 ? "HTTP(S)" : "Other";
    document.getElementById("site-url").textContent = monitor.url || "---";
    document.getElementById("site-url").href = monitor.url || undefined;
    document.getElementById("site-created").textContent = monitor.create_datetime ?
      "Created: " + new Date(monitor.create_datetime * 1000).toLocaleDateString() : "---";
    document.getElementById("site-id").textContent = monitor.id ? "ID: " + monitor.id : "---";

    // Status summary
    const isOnline = monitor.status === 2;
    const statusPulse = document.getElementById("status-pulse");
    const currentStatus = document.getElementById("current-status");
    statusPulse.className = isOnline ? "status-pulse online" : "status-pulse offline";
    currentStatus.textContent = isOnline ? "Up" : "Down";
    currentStatus.className = `fw-bold ${isOnline ? "text-success" : "text-danger"}`;

    // Uptime ratios (1, 7, 30, 90 days)
    const ratios = monitor.custom_uptime_ratio.split("-").map(parseFloat);
    const ratioLabels = ["1d", "7d", "30d", "90d"];
    const uptimeRatiosDiv = document.getElementById("uptime-ratios");
    uptimeRatiosDiv.innerHTML = "";
    ratios.forEach((r, i) => {
      const badge = document.createElement("span");
      badge.className = `badge ${r > 99 ? 'bg-success' : r > 97 ? 'bg-warning text-dark' : 'bg-danger'}`;
      badge.textContent = `${ratioLabels[i]}: ${isNaN(r) ? '---' : r.toFixed(2) + '%'}`;
      uptimeRatiosDiv.appendChild(badge);
    });

    // Uptime percent (30d)
    document.getElementById("uptime-percent").textContent = ratios[2] ? ratios[2].toFixed(2) + "%" : "---";

    // Downtime and latest downtime
    let downtimeTotal = 0;
    let latestDowntime = "---";
    let latestDowntimeDuration = "";
    if (monitor.logs && monitor.logs.length > 0) {
      // Find downtime logs
      const downtimeLogs = monitor.logs.filter(l => l.type === 1 || l.type === 2); // 1: down, 2: up
      let lastDown = null, lastUp = null;
      for (let i = downtimeLogs.length - 1; i >= 0; i--) {
        if (downtimeLogs[i].type === 1 && !lastDown) lastDown = downtimeLogs[i];
        if (downtimeLogs[i].type === 2 && !lastUp) lastUp = downtimeLogs[i];
      }
      if (lastDown) {
        latestDowntime = new Date(lastDown.datetime * 1000).toLocaleString();
        if (lastUp && lastUp.datetime > lastDown.datetime) {
          const duration = lastUp.datetime - lastDown.datetime;
          latestDowntimeDuration = `Lasted for ${Math.floor(duration / 60)} minutes`;
        }
      }
      // Calculate total downtime (last 30d)
      for (let i = 0; i < downtimeLogs.length; i++) {
        if (downtimeLogs[i].type === 1 && downtimeLogs[i + 1] && downtimeLogs[i + 1].type === 2) {
          downtimeTotal += downtimeLogs[i + 1].datetime - downtimeLogs[i].datetime;
        }
      }
    }
    document.getElementById("downtime-duration").textContent = downtimeTotal > 0 ?
      `${Math.floor(downtimeTotal / 3600)} hours, ${Math.floor((downtimeTotal % 3600) / 60)} minutes` : "0 minutes";
    document.getElementById("latest-downtime").textContent = latestDowntime;
    document.getElementById("latest-downtime-duration").textContent = latestDowntimeDuration;

    // Response time chart
    const responseTimes = monitor.response_times || [];
    const responseLabels = responseTimes.map(rt => new Date(rt.datetime * 1000).toLocaleTimeString());
    const responseData = responseTimes.map(rt => rt.value);
    document.getElementById("response-count").textContent = responseData.length + " pts";
    let high = Math.max(...responseData);
    let low = Math.min(...responseData);
    let avg = responseData.length ? (responseData.reduce((a, b) => a + b, 0) / responseData.length) : 0;
    document.getElementById("response-stats").textContent =
      `High ${high || "---"}ms, Low ${low || "---"}ms, Avg ${avg ? avg.toFixed(0) : "---"}ms`;
    const ctx = document.getElementById("responseTimeChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: responseLabels,
        datasets: [{
          label: "Response Time (ms)",
          data: responseData,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgb(54, 162, 235)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "rgb(54, 162, 235)"
        }]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1400,
          easing: 'easeInOutSine'
        },
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 0,
            beginAtZero: true,
            ticks: {
              callback: val => val + "ms"
            }
          }
        }
      }
    });

    // Uptime bar (green for uptime, yellow for warning, red for low)
    const uptimeBar = document.getElementById("uptime-bar-inner");
    let uptimePercent = ratios[2] || 100;
    uptimeBar.style.width = uptimePercent + "%";
    uptimeBar.style.background = uptimePercent > 99 ? "#28a745" : uptimePercent > 97 ? "#ffc107" : "#dc3545";
    document.getElementById("uptime-bar-labels").textContent = `Uptime | Downtime`;

    // Alert log
    const alertLogBody = document.getElementById("alert-log-body");
    alertLogBody.innerHTML = "";
    if (monitor.logs && monitor.logs.length > 0) {
      monitor.logs.slice(0, 10).forEach(log => {
        let color = log.type === 1 ? "text-danger" : log.type === 2 ? "text-success" : "text-secondary";
        let reason = log.type === 1 ? (log.reason || "Down") : log.type === 2 ? "OK" : "Other";
        let duration = log.duration ?
          `${Math.floor(log.duration / 3600)}h ${Math.floor((log.duration % 3600) / 60)}m` : "-";
        let time = new Date(log.datetime * 1000).toLocaleString();
        alertLogBody.innerHTML += `<tr><td>${time}</td><td class="${color}">${reason}</td><td>${duration}</td></tr>`;
      });
    } else {
      alertLogBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No alert log data</td></tr>';
    }
  } catch (e) {
    document.getElementById("site-title").textContent = "Error";
    document.getElementById("site-type").textContent = "-";
    document.getElementById("site-url").textContent = "-";
    document.getElementById("site-created").textContent = "-";
    document.getElementById("site-id").textContent = "-";
    document.getElementById("current-status").textContent = "-";
    document.getElementById("uptime-percent").textContent = "-";
    document.getElementById("downtime-duration").textContent = "-";
    document.getElementById("latest-downtime").textContent = "-";
    document.getElementById("latest-downtime-duration").textContent = "";
    document.getElementById("response-stats").textContent = "-";
    document.getElementById("response-count").textContent = "-";
    document.getElementById("alert-log-body").innerHTML = '<tr><td colspan="3" class="text-center text-danger">Failed to load data</td></tr>';
  } finally {
    spinner.style.display = "none";
    setShimmer(false);
  }
}

fetchStatus();
setInterval(fetchStatus, 60000); // Refresh every minute