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

    var data = {"OkPercent": 99.89037011050692, "KoPercent": 0.1096298894930714};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7741405016663743, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9944884602135722, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.46131243878550443, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.535175879396985, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.6816628701594533, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.701344243132671, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.9968304967002432, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [0.7319648093841642, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [0.9966375545851528, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.46323144104803493, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.23868677905944988, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.6218017057569296, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.5780933062880325, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.6005643919958953, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.7008125362739408, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.7154921374490391, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.6598579040852576, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 68412, 75, 0.1096298894930714, 1270.3445301993693, 1, 30015, 13.0, 1908.9000000000015, 11009.850000000002, 26207.830000000027, 221.22623205277455, 380.316676064707, 68.81201885570269], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 11612, 0, 0.0, 48.14812263176019, 2, 1447, 15.0, 109.0, 154.0, 595.8700000000008, 37.643733122400484, 127.2681680368657, 8.234566620525106], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 2042, 0, 0.0, 2550.275220372185, 4, 15819, 1166.5, 10099.900000000001, 12057.999999999996, 13894.689999999999, 6.66249037495269, 6.669837885246596, 3.1143884873014627], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 1990, 0, 0.0, 1269.5688442211042, 3, 12313, 1061.0, 2231.600000000005, 4104.49999999998, 10499.09, 6.495456444537288, 6.483675269610403, 3.0554776802325962], "isController": false}, {"data": ["S07 Medications GET /api/medications", 1756, 0, 0.0, 811.9863325740331, 4, 13984, 622.0, 1567.0, 1793.0, 11061.610000000002, 5.754716671964764, 6.668859257892253, 2.7976628529925507], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 1711, 0, 0.0, 802.1110461718306, 5, 13754, 584.0, 1413.6, 1818.0, 9466.59999999983, 5.651546330458564, 4.999364933905644, 2.857958707130329], "isController": false}, {"data": ["B2 Login page /login", 11516, 0, 0.0, 46.63329281000354, 1, 1433, 15.0, 121.0, 160.0, 315.8299999999999, 37.48356269610843, 73.72255397457263, 8.38255454825081], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 1705, 0, 0.0, 661.1835777126095, 4, 13861, 482.0, 1194.8000000000002, 1370.6999999999998, 5133.38000000001, 5.6319139588886795, 6.554977276218129, 2.892033236550296], "isController": false}, {"data": ["B3 Signup page /signup", 11450, 0, 0.0, 43.9124017467248, 2, 1442, 14.0, 120.0, 154.0, 310.4899999999998, 37.41903436015085, 88.17590811625391, 8.404665920737008], "isController": false}, {"data": ["B4 API ready /api/health/ready", 11450, 1, 0.008733624454148471, 2666.553711790393, 1, 13992, 968.0, 10708.9, 11466.899999999998, 13130.939999999999, 37.43665195357202, 18.86463633623508, 8.77421530161844], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 2254, 74, 3.283052351375333, 14681.289707187194, 187, 30015, 17619.0, 26279.5, 27451.5, 30009.0, 7.323412827344207, 7.699804090990319, 2.462442735070505], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 1876, 0, 0.0, 825.7777185501064, 4, 11491, 922.0, 1549.3, 1860.5999999999995, 2926.2900000000004, 6.124954291385885, 7.462387192568759, 2.9951991416167134], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 1972, 0, 0.0, 1001.8742393509134, 3, 12317, 966.0, 1656.8000000000002, 1847.4499999999994, 10499.08, 6.43769118016721, 5.216188655038342, 3.0535267742009196], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 1949, 0, 0.0, 928.4961518727542, 4, 12309, 1124.0, 1738.0, 2007.5, 2921.0, 6.363042768527587, 5.628076666054522, 3.2170799920421156], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 1723, 0, 0.0, 790.5977945444012, 5, 13900, 365.0, 1518.2000000000003, 2041.6, 8611.879999999994, 5.657063120742017, 6.974075043092834, 3.8030259890831486], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 1717, 0, 0.0, 733.6715200931858, 5, 13641, 533.0, 1267.8000000000002, 1872.1, 10042.279999999955, 5.663993560794741, 7.463029772665046, 2.7702349839844564], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 1689, 0, 0.0, 1224.4706927175837, 3, 13908, 602.0, 2336.0, 8326.0, 11716.299999999997, 5.591308147618481, 3.3853623550033762, 2.7455515644241846], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["503/Service Unavailable", 1, 1.3333333333333333, 0.0014617318599076186], "isController": false}, {"data": ["Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 74, 98.66666666666667, 0.10816815763316377], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 68412, 75, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 74, "503/Service Unavailable", 1, "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["B4 API ready /api/health/ready", 11450, 1, "503/Service Unavailable", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 2254, 74, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 74, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
