$(function () {
    $(document).bind('ajaxStart', function () {
        document.getElementById("preloader").style.display = "flex";
    }).bind('ajaxStop', function () {
        document.getElementById("preloader").style.display = "none";
    });
});

function ViewAllData(action, param) {
    if (action) {
        $.ajax({
            type: "GET",
            url: action,
            data: param,
            contentType: "application/json; charset=utf-8",
            dataType: "html",
            success: function (res) {
                $("#view-all").html(res);
                LoadDatatables();
                TableFilter.init();
            },
            failure: function (res) {
                Swal.fire({
                    position: "center",
                    icon: "error",
                    title: res.responseText,
                    showConfirmButton: true
                });
            },
            error: function (xhr, textStatus, errorThrown) {
                let errorMsg;
                if (xhr.status === 0) {
                    errorMsg = "Network error: Check your connection.";
                }
                else if (xhr.status === 404) {
                    errorMsg = "Requested URL not found (404).";
                }
                else if (xhr.status === 500) {
                    errorMsg = "Internal Server Error (500).";
                }
                else if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMsg = xhr.responseJSON.message;
                }
                else if (xhr.responseText) {
                    errorMsg = xhr.responseText;
                }
                else if (errorThrown) {
                    errorMsg = errorThrown;
                }
                else {
                    errorMsg = "Unexpected error (status " + xhr.status + " " + xhr.statusText + ")";
                }
                Swal.fire({
                    position: "center",
                    icon: "error",
                    title: errorMsg,
                    showConfirmButton: true
                });
            }
        });
    }
};

function LoadDatatables() {
    $('#dataTables').DataTable({
        "order": [],
        "searching": false,
        "paging": false,
        "info": false,
        "columnDefs": [{
            "targets": ['nosort'],
            "orderable": false
        }]
    });
}

var TableFilter = (function (myArray) {
    var search_input;
    function _onInputSearch(e) {
        search_input = e.target;
        var tables = document.getElementsByClassName(search_input.getAttribute('data-table'));
        myArray.forEach.call(tables, function (table) {
            myArray.forEach.call(table.tBodies, function (tbody) {
                myArray.forEach.call(tbody.rows, function (row) {
                    var text_content = row.textContent.toLowerCase();
                    var search_val = search_input.value.toLowerCase();
                    row.style.display = text_content.indexOf(search_val) > -1 ? '' : 'none';
                });
            });
        });
    }
    return {
        init: function () {
            var inputs = document.getElementsByClassName('search-input');
            myArray.forEach.call(inputs, function (input) {
                input.oninput = _onInputSearch;
            });
        }
    };
})(Array.prototype);


showInPopup = (url, title, size) => {
    $('#form-modal .modal-body').html('');
    $('#form-modal .modal-title').html('');
    $('#form-modal .modal-dialog').removeClass('modal-lg');
    $('#form-modal .modal-dialog').removeClass('modal-xl');
    $.ajax({
        type: 'GET',
        url: url,
        success: function (res) {
            $('#form-modal .modal-body').html(res);
            $('#form-modal .modal-title').html(title);
            $('#form-modal .modal-dialog').addClass(size);
            $('#form-modal').modal('show');
        },
        error: function (xhr, textStatus, errorThrown) {
            let errorMsg;
            if (xhr.status === 0) {
                errorMsg = "Network error: Check your connection.";
            }
            else if (xhr.status === 404) {
                errorMsg = "Requested URL not found (404).";
            }
            else if (xhr.status === 500) {
                errorMsg = "Internal Server Error (500).";
            }
            else if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMsg = xhr.responseJSON.message;
            }
            else if (xhr.responseText) {
                errorMsg = xhr.responseText;
            }
            else if (errorThrown) {
                errorMsg = errorThrown;
            }
            else {
                errorMsg = "Unexpected error (status " + xhr.status + " " + xhr.statusText + ")";
            }
            Swal.fire({
                position: "center",
                icon: "error",
                title: errorMsg,
                showConfirmButton: true
            });
        }
    })
}

jQueryAjaxPost = form => {
    try {
        $.ajax({
            type: 'POST',
            url: form.action,
            data: new FormData(form),
            contentType: false,
            processData: false,
            success: function (res) {
                if (res.IsValid) {
                    $('.modal').modal('hide');
                    Swal.fire({
                        position: "center",
                        icon: "success",
                        title: res.html,
                        showConfirmButton: false,
                        timer: 1500
                    });
                    if (typeof LoadPageContent === "function") {
                        LoadPageContent();
                    }
                }
                else {
                    Swal.fire({
                        position: "center",
                        icon: "error",
                        title: res.html,
                        showConfirmButton: true
                    });
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                let errorMsg;
                if (xhr.status === 0) {
                    errorMsg = "Network error: Check your connection.";
                }
                else if (xhr.status === 404) {
                    errorMsg = "Requested URL not found (404).";
                }
                else if (xhr.status === 500) {
                    errorMsg = "Internal Server Error (500).";
                }
                else if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMsg = xhr.responseJSON.message;
                }
                else if (xhr.responseText) {
                    errorMsg = xhr.responseText;
                }
                else if (errorThrown) {
                    errorMsg = errorThrown;
                }
                else {
                    errorMsg = "Unexpected error (status " + xhr.status + " " + xhr.statusText + ")";
                }
                Swal.fire({
                    position: "center",
                    icon: "error",
                    title: errorMsg,
                    showConfirmButton: true
                });
            }
        })
        return false;
    } catch (ex) {
        Swal.fire({
            position: "center",
            icon: "error",
            title: ex,
            showConfirmButton: true
        });
    }
}

// Delete Confirmed Popup
function confirmation(ev, param) {
    ev.preventDefault();
    var urlToRedirect = ev.currentTarget.getAttribute('href');
    Swal.fire({
        title: 'Are you sure?',
        html: "<p class='p-0 m-0' style='font-size:0.85rem; line-height:1.2;'>Delete (<strong>" + param + "</strong>)<br/>You can not recover it later.</p>",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'No, go back'
    }).then((result) => {
        if (result.value) {
            $.ajax({
                type: 'POST',
                url: urlToRedirect,
                contentType: false,
                processData: false,
                success: function (res) {
                    if (res.IsValid) {
                        $('.modal').modal('hide');
                        Swal.fire({
                            position: "center",
                            icon: "success",
                            title: res.html,
                            showConfirmButton: false,
                            timer: 1500
                        });
                        LoadPageContent();
                    }
                    else {
                        Swal.fire({
                            position: "center",
                            icon: "error",
                            title: res.html,
                            showConfirmButton: true
                        });
                    }
                },
                error: function (err) {
                    Swal.fire({
                        position: "center",
                        icon: "error",
                        title: err,
                        showConfirmButton: true
                    });
                }
            })
        }
    })
}

function confirmation2(ev, param) {
    ev.preventDefault();
    var urlToRedirect = ev.currentTarget.getAttribute('href');
    Swal.fire({
        title: 'Are you sure?',
        html: "<p class='p-0 m-0' style='font-size:0.85rem; line-height:1.2;'><strong>" + param + "</strong><br/>Update record status</p>",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#112266',
        confirmButtonText: 'Yes, update it!',
        cancelButtonText: 'No, go back!'
    }).then((result) => {
        if (result.value) {
            $.ajax({
                type: 'POST',
                url: urlToRedirect,
                contentType: false,
                processData: false,
                success: function (res) {
                    if (res.IsValid) {
                        Swal.fire({
                            position: "center",
                            icon: "success",
                            title: res.html,
                            showConfirmButton: false,
                            timer: 1500
                        });
                        LoadPageContent();
                    }
                    else {
                        Swal.fire({
                            position: "center",
                            icon: "error",
                            title: res.html,
                            showConfirmButton: true
                        });
                    }
                },
                error: function (err) {
                    Swal.fire({
                        position: "center",
                        icon: "error",
                        title: err,
                        showConfirmButton: true
                    });
                }
            })
        }
    })
}

function confirmationStatic(ev, param) {
    ev.preventDefault();
    var urlToRedirect = ev.currentTarget.getAttribute('href');
    Swal.fire({
        title: 'Are you sure?',
        html: "<p class='p-0 m-0' style='font-size:0.85rem; line-height:1.2;'>Delete (<strong>" + param + "</strong>)<br/>You can not recover it later.</p>",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'No, go back'
    }).then((result) => {
        if (result.value) {
            if (result.value) {
                window.location = urlToRedirect;
            }
        }
    })
}

function updateUrlStatus(ev) {
    ev.preventDefault();
    var urlToRedirect = ev.currentTarget.getAttribute('href');
    $.ajax({
        type: 'POST',
        url: urlToRedirect,
        contentType: false,
        processData: false,
        success: function (res) {
            if (res.IsValid) {
                Swal.fire({
                    position: "center",
                    icon: "success",
                    title: res.html,
                    showConfirmButton: false,
                    timer: 1500
                });
                LoadPageContent();
            }
            else {
                Swal.fire({
                    position: "center",
                    icon: "error",
                    title: res.html,
                    showConfirmButton: true
                });
            }
        },
        error: function (err) {
            Swal.fire({
                position: "center",
                icon: "error",
                title: err,
                showConfirmButton: true
            });
        }
    })
}

$("#dataTables").on('draw.dt', function () {
    $('#dataTables .dataTables_empty').html('<p class="text-danger" style="margin:0px; padding:0px; font-size:.8rem;"><i class="fa-solid fa-magnifying-glass pb-1" style="font-size:2rem; text-align:center;"></i><br />Sorry, No Result Found.</p>');
});

// Model Dismiss
$("button[data-bs-dismiss=modal]").click(function () {
    $(".modal").modal('hide');
});

function SelectAllRecords(e) {
    $("input:checkbox.Record").prop('checked', e.checked);
    GetSelectedIDs();
};

function GetSelectedIDs() {
    var SelectedIDsCounter = 0;
    var SelectedIDs = "";
    $.each($("input:checkbox.Record:checked"), function () {
        var ValueID = $(this).val();
        if (ValueID != undefined) {
            SelectedIDs += ValueID + ",";
            SelectedIDsCounter = SelectedIDsCounter + 1;
        }
    });

    var TotalChildCheckBoxes = $('.Record').length;
    var checkedChildCheckBox = $('.Record:checked').length;
    if (checkedChildCheckBox == TotalChildCheckBoxes && TotalChildCheckBoxes > 0) {
        $("#selectAll").prop('checked', true);
    }
    else {
        $("#selectAll").prop('checked', false);
    }

    if (SelectedIDs != "") {
        SelectedIDs = SelectedIDs.substring(0, (SelectedIDs.length - 1));
        $("#selectedRecords").show();
        $(".showhidebtn").show();
    }
    else {
        $("#selectedRecords").hide();
        $(".showhidebtn").hide();
    }

    //Assign Selected IDs To All Modals
    if (SelectedIDsCounter != "") {
        var tObj = document.getElementsByClassName('SelectedIDs');
        for (var i = 0; i < tObj.length; i++) {
            tObj[i].value = SelectedIDs;
        }
    }

    //Display Selected IDs Counter To All Modals
    if (SelectedIDsCounter != "") {
        var tObj = document.getElementsByClassName('SelectedIDsCounterTxt');
        for (var i = 0; i < tObj.length; i++) {
            tObj[i].innerHTML = SelectedIDsCounter;
        }
    }
    else {
        var tObj = document.getElementsByClassName('SelectedIDsCounterTxt');
        for (var i = 0; i < tObj.length; i++) {
            tObj[i].innerHTML = 0;
        }
    }
}

function SmsParameter(elem) {
    var value = $(elem).attr("value");
    const textarea = document.querySelector('#MessageBox')
    textarea.setRangeText(
        value,
        textarea.selectionStart,
        textarea.selectionEnd,
        'end'
    )
    $('#MessageBox').focus();
};

$("#SMSType").change(function () {
    var selectedValue = $(this).select("option:selected").val();
    if (selectedValue == 1) {
        $("#SmsFileBox").show();
    }
    else {
        $("#SmsFileBox").hide();
    }
});