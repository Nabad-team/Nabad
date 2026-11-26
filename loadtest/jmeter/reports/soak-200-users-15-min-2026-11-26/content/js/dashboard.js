/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 99.8844537815126, "KoPercent": 0.11554621848739496};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9633197844355134, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.998179633742309, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9965475668566418, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.9976433190836348, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.9955548238393152, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9954229623910885, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.9977950287921861, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [0.9968015881769052, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [0.9980659757699606, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.988085680922493, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.21063853050513887, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.998245998684499, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.998794256275348, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.998410610544777, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9957142857142857, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.9943319392471934, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9971286581998896, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 218960, 253, 0.11554621848739496, 111.61974333211626, 2, 27826, 21.0, 221.0, 1254.7000000000044, 3954.980000000003, 243.43089024152977, 472.4652032261875, 87.37129645070735], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 27467, 0, 0.0, 19.345869588961328, 2, 17735, 8.0, 20.0, 30.0, 169.9800000000032, 30.56198128249721, 137.52891577123745, 6.685433405546265], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 9124, 0, 0.0, 38.51918018412976, 5, 9147, 19.0, 59.0, 84.75, 250.5, 10.168463942296976, 10.47817679867801, 4.75924842183467], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 9123, 0, 0.0, 38.09010194015121, 4, 15612, 18.0, 56.0, 80.0, 206.52000000000044, 10.168267382075182, 10.160215013352609, 4.788945478336564], "isController": false}, {"data": ["S07 Medications GET /api/medications", 9111, 0, 0.0, 53.38349248161567, 5, 17521, 25.0, 71.0, 101.0, 295.8799999999992, 10.162526811737267, 20.932912254511567, 4.945021821658864], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 9067, 0, 0.0, 50.04521892577468, 6, 15168, 25.0, 80.0, 120.0, 406.6399999999994, 10.139937171978568, 9.102855748783531, 5.132040508584893], "isController": false}, {"data": ["B2 Login page /login", 27438, 0, 0.0, 20.860813470369543, 2, 17816, 8.0, 19.0, 28.0, 205.9900000000016, 30.576152874078137, 82.44214656770481, 6.837831062660052], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 9067, 0, 0.0, 39.86158597110398, 5, 15184, 20.0, 63.0, 94.0, 272.27999999999884, 10.139460921083973, 11.795722514520888, 5.211014006199754], "isController": false}, {"data": ["B3 Signup page /signup", 27404, 0, 0.0, 21.584111808495063, 2, 17821, 8.0, 19.0, 29.0, 230.9800000000032, 30.559752881286, 93.9175217943428, 6.864006994820097], "isController": false}, {"data": ["B4 API ready /api/health/ready", 27404, 253, 0.9232228871697562, 32.77193110494815, 2, 16060, 15.0, 51.0, 72.0, 286.0, 30.55859424221845, 15.43484577515224, 7.16217052551995], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 9146, 0, 0.0, 1920.3356658648659, 190, 27826, 1745.0, 3042.300000000001, 3519.0, 4662.060000000001, 10.170279343524369, 10.152310464081545, 3.535761178022144], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 9122, 0, 0.0, 42.54889278666959, 6, 17034, 26.0, 69.0, 93.0, 187.0, 10.1666202284759, 17.442562125592087, 4.976807388896629], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 9123, 0, 0.0, 30.027403266469438, 4, 2877, 17.0, 54.0, 78.0, 183.52000000000044, 10.167927394556376, 8.254221546618883, 4.828503820913855], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 9123, 0, 0.0, 38.30845116737922, 5, 16241, 22.0, 68.0, 98.0, 223.0, 10.167859399780884, 9.127966766310314, 5.146217138075808], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 9100, 0, 0.0, 50.64956043956034, 7, 16914, 25.0, 78.0, 113.0, 352.96999999999935, 10.156692088160087, 13.16291991573852, 6.834824649873153], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 9086, 0, 0.0, 55.148910411622055, 6, 17414, 29.0, 77.0, 111.0, 455.0, 10.151728452995464, 17.535290325216195, 4.969488941238743], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 9055, 0, 0.0, 34.178244064053054, 4, 16221, 16.0, 49.0, 71.0, 236.64000000000306, 10.13369085695996, 6.145529318527476, 4.980426782754596], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["503/Service Unavailable", 253, 100.0, 0.11554621848739496], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 218960, 253, "503/Service Unavailable", 253, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["B4 API ready /api/health/ready", 27404, 253, "503/Service Unavailable", 253, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
