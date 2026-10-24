// Change text into uppercase
$('.Uppercase').keyup(function () {
    var start = this.selectionStart,
        end = this.selectionEnd;
    this.value = this.value.toUpperCase();
    this.setSelectionRange(start, end);
});

// Disable Keyboard From TimePicker Field
//function disableKeyboard(evt) {
//    evt.preventDefault();
//    return false;
//}

// Enter only numbers
//function isNumber(evt) {
//    var iKeyCode = (evt.which) ? evt.which : evt.keyCode
//    if (iKeyCode != 46 && iKeyCode > 31 && (iKeyCode < 48 || iKeyCode > 57))
//        return false;
//    return true;
//}