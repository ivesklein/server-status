function drawChart(serverId, data, globalMax, startTime) {
    const canvas = document.getElementById(`chart-${serverId}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const timeRange = 3 * 60 * 60 * 1000; // 3 hours
    
    if (data.length < 1) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
        const x = (i / 6) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw response time (blue)
    const maxResponse = 200;
    if (maxResponse > 0) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, i) => {
            const pointTime = new Date(point.timestamp).getTime();
            const x = ((pointTime - startTime) / timeRange) * width;
            const y = height - (point.responseTime / maxResponse) * height;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
    }
    
    // Draw activity (green) if available
    const activityData = data.filter(d => d.activity !== undefined);
    if (activityData.length > 0) {
        const maxActivity = globalMax.activity || Math.max(...activityData.map(d => d.activity));
        if (maxActivity > 0) {
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            activityData.forEach((point, i) => {
                const pointTime = new Date(point.timestamp).getTime();
                const x = ((pointTime - startTime) / timeRange) * width;
                const y = height - (point.activity / maxActivity) * height;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            
            ctx.stroke();
        }
    }
    
    // Draw active games (orange) if available
    const gamesData = data.filter(d => d.activeGames !== undefined);
    if (gamesData.length > 0) {
        const maxGames = globalMax.games || Math.max(...gamesData.map(d => d.activeGames));
        if (maxGames > 0) {
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            gamesData.forEach((point, i) => {
                const pointTime = new Date(point.timestamp).getTime();
                const x = ((pointTime - startTime) / timeRange) * width;
                const y = height - (point.activeGames / maxGames) * height;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            
            ctx.stroke();
        }
    }
    
    // Running matches (purple) if available
    const matchesData = data.filter(d => d.runningMatches !== undefined);
    if (matchesData.length > 0) {
        const maxMatches = globalMax.matches || Math.max(...matchesData.map(d => d.runningMatches));
        if (maxMatches > 0) {
            ctx.strokeStyle = '#9C27B0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            matchesData.forEach((point, i) => {
                const pointTime = new Date(point.timestamp).getTime();
                const x = ((pointTime - startTime) / timeRange) * width;
                const y = height - (point.runningMatches / maxMatches) * height;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            
            ctx.stroke();
        }
    }
    
    // Legend with colored titles on left and last values on right
    ctx.font = '10px Arial';
    const responseY = Math.min(height - 10, Math.max(10, height - (data[data.length - 1]?.responseTime / 200) * height - 5));
    
    // Response time
    ctx.fillStyle = '#2196F3';
    ctx.fillText('Response', 5, responseY);
    const lastResponse = data[data.length - 1]?.responseTime || 0;
    ctx.fillText(`${lastResponse}ms`, width - 40, responseY);    
    // Activity
    if (activityData.length > 0) {
        const activityY = Math.min(height - 5, Math.max(10, height - (activityData[activityData.length - 1].activity / (globalMax.activity || Math.max(...activityData.map(d => d.activity)))) * height));
        ctx.fillStyle = '#4CAF50';
        ctx.fillText('Activity', 5, activityY);
        const lastActivity = activityData[activityData.length - 1]?.activity || 0;
        ctx.fillText(lastActivity, width - 25, activityY);
    }
    
    // Games
    if (gamesData.length > 0) {
        const gamesY = Math.min(height - 5, Math.max(10, height - (gamesData[gamesData.length - 1].activeGames / (globalMax.games || Math.max(...gamesData.map(d => d.activeGames)))) * height));
        ctx.fillStyle = '#FF9800';
        ctx.fillText('Games', 5, gamesY);
        const lastGames = gamesData[gamesData.length - 1]?.activeGames || 0;
        ctx.fillText(lastGames, width - 25, gamesY);
    }
    
    // Matches
    if (matchesData.length > 0) {
        const matchesY = Math.min(height - 5, Math.max(10, height - (matchesData[matchesData.length - 1].runningMatches / (globalMax.matches || Math.max(...matchesData.map(d => d.runningMatches)))) * height));
        ctx.fillStyle = '#9C27B0';
        ctx.fillText('Matches', 5, matchesY);
        const lastMatches = matchesData[matchesData.length - 1]?.runningMatches || 0;
        ctx.fillText(lastMatches, width - 25, matchesY);
    }
    
    // Store data for hover functionality
    canvas.chartData = { data, activityData, gamesData, matchesData, globalMax, startTime, timeRange };
}

// Initialize chart hover functionality
function initChartHover() {
    document.addEventListener('mousemove', (e) => {
        const canvas = e.target;
        if (canvas.tagName !== 'CANVAS' || !canvas.chartData) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        const { data, activityData, gamesData, matchesData, globalMax, startTime, timeRange } = canvas.chartData;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Find closest data point
        const timeAtX = startTime + (x / width) * timeRange;
        let closestPoint = null;
        let minDistance = Infinity;
        
        data.forEach(point => {
            const distance = Math.abs(new Date(point.timestamp).getTime() - timeAtX);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        if (closestPoint) {
            // Clear and redraw chart
            drawChart(canvas.id.replace('chart-', ''), data, globalMax, startTime);
            
            // Draw hover line
            const pointTime = new Date(closestPoint.timestamp).getTime();
            const lineX = ((pointTime - startTime) / timeRange) * width;
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, height);
            ctx.stroke();
            ctx.setLineDash([]);

            const activityPoint = activityData.find(p => p.timestamp === closestPoint.timestamp);
            const gamesPoint = gamesData.find(p => p.timestamp === closestPoint.timestamp);
            const matchesPoint = matchesData.find(p => p.timestamp === closestPoint.timestamp);

            // Show values tooltip
            // Calculate tooltip width based on the longest possible text
            const tooltipWidth = Math.max(
                ctx.measureText(`${closestPoint.responseTime}ms`).width,
                activityPoint ? ctx.measureText(`Act: ${activityPoint.activity}`).width : 0,
                gamesPoint ? ctx.measureText(`Games: ${gamesPoint.activeGames}`).width : 0, 
                matchesPoint ? ctx.measureText(`Matches: ${matchesPoint.runningMatches}`).width : 0
            ) + 6; // Add padding            
            const tooltipX = lineX + tooltipWidth > width ? lineX - tooltipWidth - 5 : lineX + 5;
            const textX = tooltipX + 3;
            
            ctx.fillStyle = '#2196F3';
            ctx.font = '10px Arial';
            const responseY = Math.min(height - 5, Math.max(10, height - (closestPoint.responseTime / 200) * height));
            ctx.fillText(`${closestPoint.responseTime}ms`, textX, responseY);
            
            if (activityPoint) {
                ctx.fillStyle = '#4CAF50';
                const activityY = Math.min(height - 5, Math.max(10, height - (activityPoint.activity / (globalMax.activity || Math.max(...activityData.map(d => d.activity)))) * height));
                ctx.fillText(`Act: ${activityPoint.activity}`, textX, activityY);
            }
            
            if (gamesPoint) {
                ctx.fillStyle = '#FF9800';
                const gamesY = Math.min(height - 5, Math.max(10, height - (gamesPoint.activeGames / (globalMax.games || Math.max(...gamesData.map(d => d.activeGames)))) * height));
                ctx.fillText(`Games: ${gamesPoint.activeGames}`, textX, gamesY);
            }
            
            if (matchesPoint) {
                ctx.fillStyle = '#9C27B0';
                const matchesY = Math.min(height - 5, Math.max(10, height - (matchesPoint.runningMatches / (globalMax.matches || Math.max(...matchesData.map(d => d.runningMatches)))) * height));
                ctx.fillText(`Matches: ${matchesPoint.runningMatches}`, textX, matchesY);
            }        
        }
    });
}