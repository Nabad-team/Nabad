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

    var data = {"OkPercent": 99.99827508883293, "KoPercent": 0.0017249111670748956};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9718753234208438, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9998478701825558, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.9998984771573604, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9999490419894007, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [1.0, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [1.0, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [1.0, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.9998944256756757, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.3414745145631068, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [1.0, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [1.0, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [1.0, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9997966653111021, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [1.0, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9997448458869157, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 231896, 4, 0.0017249111670748956, 80.48294062856002, 2, 5869, 11.0, 41.0, 89.0, 2018.0, 257.67195649613427, 414.9901468065877, 93.28740656938706], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 28489, 0, 0.0, 8.231352451823469, 2, 262, 7.0, 12.0, 15.0, 38.0, 31.683205754557193, 107.11646320534864, 6.9307012588093855], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 9860, 0, 0.0, 17.487119675456277, 4, 780, 13.0, 30.0, 42.0, 81.0, 10.986060182662749, 11.006620744712263, 5.1497157106231635], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 9860, 0, 0.0, 15.87322515212979, 4, 285, 11.0, 29.0, 42.0, 75.0, 10.986023460619673, 10.974398338336096, 5.181884112772757], "isController": false}, {"data": ["S07 Medications GET /api/medications", 9850, 1, 0.01015228426395939, 22.031167512690377, 5, 487, 17.0, 37.0, 51.0, 99.0, 10.985714110452712, 23.032594573684584, 5.353389981558499], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 9812, 0, 0.0, 22.727272727272734, 5, 580, 16.0, 41.0, 58.0, 108.8700000000008, 10.983684549296168, 9.728712779503539, 5.566926055746788], "isController": false}, {"data": ["B2 Login page /login", 28457, 0, 0.0, 8.049618722985562, 2, 229, 7.0, 12.0, 14.0, 38.0, 31.698346076387033, 62.34420800570653, 7.088790284660772], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 9812, 0, 0.0, 17.96055849979616, 4, 315, 13.0, 33.0, 45.0, 85.0, 10.98365995878329, 12.796392901199672, 5.6527234358191345], "isController": false}, {"data": ["B3 Signup page /signup", 28416, 0, 0.0, 8.199711430180205, 2, 238, 7.0, 12.0, 15.0, 38.0, 31.672185744172644, 74.63377363348495, 7.113869844882528], "isController": false}, {"data": ["B4 API ready /api/health/ready", 28416, 0, 0.0, 11.826893299549496, 2, 809, 8.0, 24.0, 35.0, 76.0, 31.672150442714603, 15.959794559024155, 7.423160260011235], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 9888, 0, 0.0, 1569.9265776699028, 189, 5869, 1337.5, 3030.0, 3499.0999999999985, 4774.770000000004, 10.998067997157053, 10.975691284339765, 3.8235470771366318], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 9860, 0, 0.0, 21.198985801217, 4, 355, 16.0, 37.0, 49.0, 84.38999999999942, 10.985852094331255, 19.32508247745449, 5.385642335306924], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 9860, 0, 0.0, 16.056795131845853, 4, 477, 11.0, 29.0, 40.0, 74.0, 10.985937776807193, 8.91534598879568, 5.224757516899515], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 9860, 0, 0.0, 20.282758620689577, 5, 299, 15.0, 38.0, 51.0, 92.38999999999942, 10.985925536371658, 9.730697716297945, 5.56806186853212], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 9836, 1, 0.010166734444896299, 22.917344448963128, 5, 585, 16.0, 40.0, 55.0, 107.6299999999992, 10.990963407779716, 13.56399030056698, 7.404220822643329], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 9822, 0, 0.0, 23.63235593565461, 5, 444, 18.0, 40.0, 55.0, 102.0, 10.98527467660434, 19.451139864149216, 5.385359265288455], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 9798, 2, 0.020412329046744233, 14.039599918350616, 3, 735, 10.0, 24.0, 34.0, 73.0, 10.983122892603488, 6.648978746401733, 5.405755798703279], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["500/Internal Server Error", 4, 100.0, 0.0017249111670748956], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 231896, 4, "500/Internal Server Error", 4, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["S07 Medications GET /api/medications", 9850, 1, "500/Internal Server Error", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 9836, 1, "500/Internal Server Error", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 9798, 2, "500/Internal Server Error", 2, "", "", "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
