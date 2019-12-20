$(document).ready(function() {
	function grabData(json) {
		var temperature = [],
			mapTop = 43.50055,
			mapBottom = 40.375445,
			mapLeft = -96.639525,
			mapRight = -90.158181,
			mapHeight = mapTop - mapBottom,
			mapWidth = mapRight - mapLeft,
			canvasWidth = document.getElementById('ia-temperature-map').width,
			canvasHeight = document.getElementById('ia-temperature-map').height;

		// Cycle through all sites and store pulled data
		for (var i = 0; i < json.value.timeSeries.length; i++) {
			var title = json.value.timeSeries[i].sourceInfo.siteName;
			var siteCode = json.value.timeSeries[i].sourceInfo.siteCode[0].value; // SiteCode
			var url = 'http://waterdata.usgs.gov/ia/nwis/uv?cb_99133=on&format=gif_default&site_no=' + siteCode; //URL

			// Find lat/long ratio then scale to size of image in whole numbers
			var longitude = json.value.timeSeries[i].sourceInfo.geoLocation.geogLocation.longitude;
			var x = Math.round(((longitude - mapLeft) / mapWidth) * canvasWidth);
			var latitude = json.value.timeSeries[i].sourceInfo.geoLocation.geogLocation.latitude;
			var y = Math.round((1-((latitude - mapBottom) / mapHeight)) * canvasHeight);

			// The "L" qualifier code stops waterservices from reporting data, makes value = undefined
			// Assume the worst, no value was found. Treat the same as a sensor error
			var timeStamp = '',
				date = '',
				time = '',
				epoch = 0,
				value = -999999;

			// If no "L" qualifier code, everything looks good
			if (typeof json.value.timeSeries[i].values[0].value[0] === 'undefined'){
				//console.log('"L" qualifier error:', siteCode);
			} else {
				// Convert DateTime to JavaScript Epoch
				timeStamp = json.value.timeSeries[i].values[0].value[0].dateTime;
				var epochTimestamp = new Date(timeStamp);
				epoch = epochTimestamp.getTime();
				
				date = (timeStamp.substr(5,2) + '/' + timeStamp.substr(8,2) + '/' + timeStamp.substr(0,4));
				time = (timeStamp.substr(11,5));
				value = json.value.timeSeries[i].values[0].value[0].value;
			}
			
			temperature.push({
				"title": title,
				"siteCode": siteCode, 
				"value": value,
				"date": date,
				"time": time,
				"epoch": epoch,
				"url": url,
				"x": x,
				"y": y });
		}
		return temperature;
	}
	function populateTable(data) {
		var tableRow = '',
			nintydays = 7776000000, // milliseconds
			epochNow = new Date().getTime();
		
		for (var i = 0; i < data.length; i++) {
			// Skip sites older than 90 days
			var dateDifference = epochNow - data[i].epoch;
			if (dateDifference > nintydays) {
				//Ignore
			} else {
				tableRow = '<tr><td id="temperature-code-' + data[i].siteCode + '" readonly="readonly"><a href="' + data[i].url + '">' + data[i].siteCode + '</a></td>' +
				'<td id="temperature-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].value + '</td>' +
				'<td id="temperature-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].time + '</td>' +
				'<td id="temperature-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].date + '</td>';

				$('#ia-temperature-table tbody').append(tableRow);
			}
		}
	}
	function populateImgMap(data) {
		for (var i = 0; i < data.length; i++) {
			$('#ia-temperature-imgmap').append(
				'<area id="' + data[i].siteCode + 
				'" href="' + data[i].url + 
				'" title="Temperature: ' + data[i].value + '&deg;C Site: ' + data[i].siteCode + ' ' + data[i].title + 
				'" coords="' + data[i].x + ',' + data[i].y + ',5" shape="circle">');
		}
	}
	function plotCanvas(data) {
		var canvas = document.getElementById('ia-temperature-map');
		
		if (canvas.getContext) {
			var context = canvas.getContext('2d');
			var backgroundImg = new Image();
			
			backgroundImg.onload = function() {

				// Draw background
				context.drawImage(backgroundImg, 0, 0);
				
				var dotRadius = 5,
					startAngle = 0,
					endAngle = Math.PI * 2,
					oneday = 86400000,      // milliseconds
					nintydays = 7776000000; // milliseconds
					realtimeData = true,
					epochNow = new Date().getTime();
				
				// Loop for all sites
				for (var i = 0; i < data.length; i++) {
					var x = data[i].x,
						y = data[i].y,
						val = data[i].value,
						dateDifference = epochNow - data[i].epoch;

					// Draw colored circles for data within 1 day old
					if (dateDifference <= oneday) {
						// Draw colored circle
						context.beginPath();
						context.arc(x, y, dotRadius, startAngle, endAngle, true);
						if (val === -999999) { // Site is down/broken
							context.fillStyle = "rgb(255,255,255)"; // White
						} else if (val < 1.0) {
							context.fillStyle = "rgb(0,112,181)";   // Low
						} else if (val >= 1.0 && val < 5.0) {
							context.fillStyle = "rgb(71,187,181)";
						} else if (val >= 5.0 && val < 10.0) {
							context.fillStyle = "rgb(215,223,239)";
						} else if (val >= 10.0 && val < 20.0) {
							context.fillStyle = "rgb(247,216,168)";
						} else if (val >= 20.0 && val < 30.0) {
							context.fillStyle = "rgb(238,133,122)";
						} else if (val >= 30.0 && val < 35.0) {
							context.fillStyle = "rgb(205,77,83)";
						} else if (val > 35.0) {
							context.fillStyle = "rgb(175,55,72)";   // High
						} else {
							context.fillStyle = "rgb(255,255,255)"; // White. Used for null vaules
						}
						context.fill();
						context.stroke();
						context.closePath();
					}
					// Draw empty circles for data that's between 24 Hours and 90 days old
					else if (dateDifference <= nintydays) {
						context.beginPath();
						context.arc(x, y, dotRadius, startAngle, endAngle, true);
						context.stroke();
						context.closePath();
						// Activate non-realtime data message
						realtimeData = false;
						//console.log(">1 days old:       ", data[i].siteCode, data[i].date, data[i].time, data[i].value);

					}
					// Ignore data that's older than 90 days (259200000 milliseconds)
					else {
						//console.log(">90 days old:       ", data[i].siteCode, data[i].date, data[i].time, data[i].value);
					}
				}
				// Error: Sites go down from time to time. Notify user that a site is reporting old data
				if (realtimeData === false) {
					$('#ia-temperature-status-container').show();
					$('#ia-temperature-status-container').append('<p class="map-status-information">1 or more sites are not reporting realtime data</p>');
				}
			};
			backgroundImg.src = 'img/ia-340-blank.png';
		}	
		else {
			// Error: No canvas support
			$('#ia-temperature-status-container').append('<p class="map-status-nocanvas">&lt;canvas&gt; tag unsupported.</p>');
		}
	}
	
	// Hide status bar's
	$('#ia-temperature-status-container').hide();

	// Pull data from server
	$.ajax({
		// url: 'proxy/temperature.php', // To avoid "same origin" error
		url: 'https://waterservices.usgs.gov/nwis/iv/?format=json,1.1&stateCd=ia&parameterCd=00010',
		dataType: 'json',
		data: '',
		beforeSend: function(){ $("#ia-temperature-map").addClass("loading"); },
		complete: function(){ $("#ia-temperature-map").removeClass("loading"); },
		success: function(json){
			var data = grabData(json);
			populateTable(data);
			populateImgMap(data);
			plotCanvas(data);
			
			//TableSorter jQuery plug-in
			$("#ia-temperature-table").tablesorter({
				sortList: [[3,0], [1,0], [2,0], [0,0]], //Sort first by date, then temp, time, & stationID
				widgets: ['zebra']
			});
		}
	});
});
