document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('bgm');
    audio.play().catch(e => console.log('Autoplay diblokir'));
});
