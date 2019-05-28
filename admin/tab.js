'use strict';

// console.log('starting moma admin-tab script');

//==== socket.io connection ======================================
let firstConnect = true;
let main = {
    socket: io.connect(location.protocol + '//' + location.host, {
        query: 'ws=true'
    }),
    subscribe: (isSubscribe) => {
        if (!main.socket) return;
        if (isSubscribe) {
            // console.log('subscribe objects');
            main.socket.emit('subscribeObjects', 'moma.meta.*');
            main.socket.emit('subscribeStates', 'moma.meta.*');
            main.socket.emit('requireLog', true);
        } else {
            // console.log('unsubscribe objects');
            main.socket.emit('unsubscribeObjects', 'moma.meta.*');
            main.socket.emit('unsubscribeStates', 'moma.meta.*');
            main.socket.emit('requireLog', false);
        }
    }
};

main.socket.on('connect',() => {
    main.subscribe(true);
});

main.socket.on('disconnect', () => {
    main.subscribe(false);
});

main.socket.on('objectChange', (id, obj) => {
    // console.log('obj: ', id);//, obj);
    createHostBody();
});

main.socket.on('stateChange', (id, obj) => {
    // console.log('state: ', id);//, obj);
    let arr = id.split('.'); 
    // moma.meta.hosts.mint-master.momaAlive
    if (arr[0] == 'moma' && arr[1] == 'meta' && arr[2] == 'hosts'){
        let hostname = arr[3]
        let statename = arr[4];
        let value = obj['val'];
        for(let i = 0; i<that.list.length; i++) {
            if(that.list[i].id == hostname) {
                that.list[i][statename] = value;
            } 
        }
        // console.log('moma: ', hostname, statename, value);
        createHostBody();
    // system.host.mint-master.alive
    } else if(arr[0] == 'system' && arr[1] == 'host') {
        let hostname = arr[2]
        let statename = arr[3];
        let value = obj['val'];
        for(let i = 0; i<that.list.length; i++) {
            if(that.list[i].id == hostname) {
                that.list[i][statename] = value;
                if(statename == 'alive') {
                    createHostBody();
                }
            } 
        }
        // console.log('system: ', hostname, statename, value);
    }
});

//==== moma tab ==================================================
// to avoid conflicts with different "this" objects
// sometimes we need that :-)
let that = this;

// access to admin-tab moma
that.$tab = $('#tab-moma');
that.$dialogUpdate = $('#dialog-update');
that.$dialogReboot = $('#dialog-reboot');
that.$dialogDetails = $('#dialog-details');
// data for each host
that.list;
// translation
that.words = {};
// communication
that.main = main;

function Moma() {
    // set global language dependant on browser settings
    systemLang = navigator.language;
    // console.log('sprache: ' + systemLang);
    // cache translations for table lines /grid elements
    that.words['update'] = _('update');
    that.words['reboot'] = _('reboot');
    that.words['details'] = _('details');
    that.words['online'] = _('online');
    that.words['needsAttention'] = _('needsAttention');
    that.words['momaOffline'] = _('momaOffline');
    that.words['offline'] = _('offline');

    // prepare the table below buttons
    showHostsTable();

    // connect and enable global buttons depending on data 
    // button reload in main page headline
    window.document.querySelector('#btn-reload').title = _('reload');
    $('#btn-reload').click(() => {
        showHostsTable();        
    });

    // confirm button in update all dialog
    $('#updateAllOk').click(() => {
        for (let i = 0; i < that.list.length; i++) {
            if(that.list[i]['numUpdates'] > 0 && !that.list[i].buttonsDisabled) {
                update(i);
            }
        }
        createHostBody();
    });
    // update all button in main page headline
    window.document.querySelector('#btn-update-all').title = _('update-all');
    $('#btn-update-all').click(() => {
        let $dialog = $('#dialog-update-all');
        if (!$dialog.data('inited')) {
            $dialog.data('inited', true);
            $dialog.find('#dialog-updateAll-headline').text(_('dialogUpdateAll'));
            $dialog.find('#textUpdateAll').text(_('textUpdateAll').replace('? ', '?\n'));
            $dialog.modal();
        }
        $dialog.modal('open');

    });

    // confirm button in reboot all dialog
    $('#rebootAllOk').click(() => {
        for (let i = 0; i < that.list.length; i++) {
            if(that.list[i]['needsReboot'] && !that.list[i].buttonsDisabled) {
                reboot(i);
            }
        }
        createHostBody();
    });
    // reboot all button in main page headline
    window.document.querySelector('#btn-reboot-all').title = _('reboot-all');
    $('#btn-reboot-all').click(() => {
        let $dialog = $('#dialog-reboot-all');
        if (!$dialog.data('inited')) {
            $dialog.data('inited', true);
            $dialog.find('#dialog-rebootAll-headline').text(_('dialogRebootAll'));
            $dialog.find('#textRebootAll').text(_('textRebootAll').replace('? ', '?\n'));
            $dialog.modal();
        }
        $dialog.modal('open');
    });
}

function update(i) {
    console.log('updating ' + that.list[i]['instance']);
    // that.list[i].numUpdates = 0;
    // $('#btnUpdate'+i).disabled=true;
    that.list[i].buttonsDisabled = true;
    main.socket.emit('sendTo', that.list[i]['instance'], 'execute', 'doUpdates', (result) => {
        console.log(result);
    });
}

function reboot(i) {
    console.log('rebooting ' + that.list[i]['instance']);
    // that.list[i].needsReboot = false;
    // $('#btnReboot'+i).disabled=true;
    that.list[i].buttonsDisabled = true;
    main.socket.emit('sendTo', that.list[i]['instance'], 'execute', 'scheduleReboot', (result) => {
        console.log(result);
    });
}

function fetchData(callback) {
    that.list = [];

    that.main.socket.emit('getForeignObjects', 'moma.meta.hosts.*',  'channel', function (err, res) {
        if(res) {
            // console.log(res);
            for(let line in res) {
                // console.log(line);
                let host = {};
                host.id = line.split('.')[3];
                host['buttonsDisabled'] = false;
                that.main.socket.emit('getForeignStates', line + '.*', function (err2, res2) {
                    if(res2) {
                        // console.log('res2: ' + JSON.stringify(res2));
                        for(let state in res2) {
                            // console.log('state: ' + JSON.stringify(state));
                            let name = state.split('.')[4];
                            if(res2[state]) {
                                host[name] = res2[state]['val'];
                            }
                    }
                    } else if(err2) {
                        console.log('err2: ' + JSON.stringify(err2));
                    }
                    // console.log('before host', host);
                    // get system information
                    that.main.socket.emit('getForeignStates', 'system.host.'+host.id+'.*', function (err3, res3) {
                        // console.log(JSON.stringify(res3));
                        if(res3) {
                            for(let state in res3) {
                                //console.log(JSON.stringify(state));
                                let name = state.split('.')[3];
                                // console.log(name);
                                if(res3[state]) {
                                    host[name] = res3[state]['val'];
                                }
                            }
                            // console.log('after host', host);
                            that.list.push(host);
                            if(callback) callback();
                        } else  if(err3){
                            console.log('err3: ' + JSON.stringify(err3));
                        }
                    });
                });
            }
        } else if (err) {
            console.log('err: ' + JSON.stringify(err));
        }
        // console.log('list', that.list);
    });

}

function showHostsTable() {
    // create table header
    createHostHeader();
    
    // fetch data before creating table body
    fetchData(function() {
        createHostBody();
    });
}

function createHostHeader() {
    let text = '<tr>';
    // col for host-state led
    text += '<th scope="col" style="width: 15px;"></th>'
    // col for hostname
    text += '<th scope="col" class="translate" style="width: 100px;">'+_('hostname') + '</th>'
    // col for number of updates
    text += '<th scope="col" style="width: 20px;">#</th>'
    // col for list of updates
    text += '<th scope="col" style="overflow:hidden;" class="translate">'+_('updatelist') + '</th>'
    // col for button Update
    text += '<th scope="col" style="width: 15px;"> </th>'
    // col for button Reboot
    text += '<th scope="col" style="width: 15px;"> </th>'
    // col for button Details
    text += '<th scope="col" style="width: 15px;"> </th>'
    // col for button Update JS-Controller
    text += '<th scope="col" style="width: 15px;"> </th>'

    text += '</tr>';

    let header = that.$tab.find('#table-hosts-head');
    header.html(text);
    header.show();
}

function createHostFooter() {
    let text = '<tr>';
    // col for host-state led
    text += '<td></td>'
    // col for hostname
    text += '<td></td>'
    // col for number of updates
    text += '<td></td>'
    // col for list of updates
    text += '<td></td>'
    // col for button Update
    text += '<td></td>'
    // col for button Reboot
    text += '<td></td>'
    // col for button Details
    text += '<td></td>'
    // col for button Update JS-Controller
    text += '<td></td>'

    text += '</tr>';

    let footer = that.$tab.find('#table-hosts-foot');
    footer.html(text);
    footer.show();
}

function createHostBody() {
    // console.log('preparing table ' + JSON.stringify(that.list));
    let text = '';
    for (let i = 0; i < that.list.length; i++) {
        text += createHostRow(i);
    }
    let body = that.$tab.find('#table-hosts-body');
    body.html(text);
    body.show();
    
    for (let i = 0; i < that.list.length; i++) {
        let button= window.document.querySelector('#btnUpdate'+i+'');
        if(that.list[i].numUpdates > 0) {
            button.style.visibility='visible';
            button.disabled = that.list[i].buttonsDisabled;
            if(that.list[i].alive && that.list[i].momaAlive) {
                button.addEventListener('click', (obj) => {
                    $('#updateOk').click((obj) => {
                        // console.log('update ' + i);
                        update(i);
                        createHostBody();
                    }); 
                    if (!that.$dialogUpdate.data('inited')) {
                        that.$dialogUpdate.data('inited', true);
                        that.$dialogUpdate.find('#dialog-update-headline').text(_('dialogUpdate') + `"${that.list[i]['id']}"`);
                        that.$dialogUpdate.find('#textUpdateSingle').text(_('textUpdateSingle').replace('? ', '?\n'));
                        that.$dialogUpdate.modal();
                    }
                    that.$dialogUpdate.modal('open');
                });
            } else {
                button.disabled = true;
            }
        } else {
            button.style.visibility='hidden';
        }
        button= window.document.querySelector('#btnReboot'+i+'');
        if(that.list[i].needsReboot) {
            button.style.visibility='visible';
            button.disabled = that.list[i].buttonsDisabled;
            if(that.list[i].alive && that.list[i].momaAlive) {
                button.addEventListener('click', (obj) => {
                    $('#rebootOk').click((obj) => {
                        // console.log('reboot ' + i);
                        reboot(i);
                        createHostBody();
                    }); 
                    if (!that.$dialogReboot.data('inited')) {
                        that.$dialogReboot.data('inited', true);
                        that.$dialogReboot.find('#dialog-reboot-headline').text(_('dialogReboot') + `"${that.list[i]['id']}"`);
                        that.$dialogReboot.find('#textRebootSingle').text(_('textRebootSingle').replace('? ', '?\n'));
                        that.$dialogReboot.modal();
                    }
                    that.$dialogReboot.modal('open');
                });
            } else {
                button.disabled = true;
            }
        } else {
            button.style.visibility='hidden';
        }
        button= window.document.querySelector('#btnDetails'+i+'');
        button.addEventListener('click', (obj) => {
            if (!that.$dialogDetails.data('inited')) {
                that.$dialogDetails.data('inited', true);
                that.$dialogDetails.find('#dialog-details-headline').text(_('dialogDetails') + `"${that.list[i]['id']}"`);
                that.$dialogDetails.modal();
            }
            that.$dialogDetails.modal('open');
        });

        button= window.document.querySelector('#btnJSController'+i+'');
        button.addEventListener('click', (obj) => {
            // if (!that.$dialogDetails.data('inited')) {
            //     that.$dialogDetails.data('inited', true);
            //     that.$dialogDetails.find('#dialog-details-headline').text(_('dialogDetails') + `"${that.list[i]['id']}"`);
            //     that.$dialogDetails.modal();
            // }
            // that.$dialogDetails.modal('open');
            that.list[i].buttonsDisabled = true;
            main.socket.emit('sendTo', that.list[i]['instance'], 'execute', 'updateJSController', (result) => {
                console.log(result);
            });
        });
    }
}

function createHostRow(index) {
    let obj = that.list[index];
    let machineAlive = obj['alive'];
    let momaAlive = obj['momaAlive'];
    let allOk = !obj['needsAttention'];
    // console.log(JSON.stringify(instance));
    let state = machineAlive ? (momaAlive ? (allOk ? 'online' : 'needsAttention') : 'momaOffline') : 'offline';
    // let state= machineAlive ? (momaAlive ? 'online' : 'moma') : 'offline';
    // let _class = machineAlive ? (momaAlive ? (momaAlive ? 'led-green' : 'led-yellow') : 'led-orange') : 'led-red';
    let text = '<tr>';
    //LED
    // text += '<td><button type="button" title="' + that.words[state] + '" class="led ' + _class + '" id="' + state + index + '"></button></td>'
    text += '<td><button type="button" disabled title="' + that.words[state] + '" class="led" id="' + state + index + '"></button></td>'
    // hostname
    text += '<th scope="row">' + obj['id'] + '</th>'
    // number of updates
    text += '<td>' + obj['numUpdates'] + '</td>'
    // list of updates
    text += '<td style="overflow:hidden;" title="' + that.words['updates'] +'">' + obj['updates'] + '</td>'
    // button Update
    text += '<td><button type="button" title="' + that.words['update'] + '" class="btn update" id="btnUpdate' + index + '">U</button></td>'
    // button Reboot
    text += '<td><button type="button" title="' + that.words['reboot'] + '" class="btn reboot" id="btnReboot' + index + '">R</button></td>'
    // button Details
    text += '<td><button type="button" title="' + that.words['details']+ '" class="btn details" id="btnDetails'+index + '">I</button></td>'
    // button Update JS-Controller
    text += '<td><button type="button" title="' + that.words['jscontroller']+ '" class="btn jscontrooler" id="btnJSController'+index + '">C</button></td>'
    text += '</tr>';

    return text;
}

// ==== start of tab creation =============================================================
let moma = new Moma();
