/* "See more" dialog for the Signal section — when the on-page list (capped
   at 5) isn't enough, this points people at the real, primary sources
   instead of trying to cram more into an already-tight card. Extracted
   from an inline <script> block, unmodified. */
(function(){
  var dlg=document.getElementById('signal-dialog'); if(!dlg) return;
  var panel=dlg.querySelector('.sig-dialog__panel');
  var titleEl=document.getElementById('sig-dialog-title');
  var eyebrowEl=document.getElementById('sig-dialog-eyebrow');
  var listEl=document.getElementById('sig-dialog-list');
  var lastFocused=null;

  function favicon(host){ return 'https://www.google.com/s2/favicons?sz=64&domain='+host; }

  var DATA={
    news:{
      title:'More security news',
      eyebrow:'Where the daily feed pulls from',
      items:[
        {name:'The Hacker News', host:'thehackernews.com', url:'https://thehackernews.com', how:'Daily roundup of what’s breaking — good first stop each morning.'},
        {name:'BleepingComputer', host:'www.bleepingcomputer.com', url:'https://www.bleepingcomputer.com', how:'Breach and malware reporting, plus an active forum for the technical back-and-forth.'},
        {name:'Krebs on Security', host:'krebsonsecurity.com', url:'https://krebsonsecurity.com', how:'Slower, deeper investigative pieces — worth the wait.'},
        {name:'Dark Reading', host:'www.darkreading.com', url:'https://www.darkreading.com', how:'More of an analyst/enterprise angle on the same stories.'},
        {name:'The Record', host:'therecord.media', url:'https://therecord.media', how:'Strong specifically on ransomware and threat-actor tracking.'}
      ]
    },
    podcasts:{
      title:'More to listen to',
      eyebrow:'Security podcasts, and where to find them',
      items:[
        {name:'Darknet Diaries', host:'darknetdiaries.com', url:'https://darknetdiaries.com', how:'Narrative, true-crime style. Episodes stand alone — start anywhere. On Spotify, Apple Podcasts, and YouTube.'},
        {name:'Risky Business', host:'risky.biz', url:'https://risky.biz', how:'Weekly news wrap for practitioners — dense but efficient. Also on Spotify.'},
        {name:'Critical Thinking — Bug Bounty', host:'www.criticalthinkingpodcast.io', url:'https://www.criticalthinkingpodcast.io', how:'Long-form hunter methodology. Useful if you do bug bounty yourself. Spotify and YouTube.'},
        {name:'Smashing Security', host:'smashingsecurity.com', url:'https://smashingsecurity.com', how:'Lighter weekly news — an easier listen for a commute.'},
        {name:'Security Now', host:'twit.tv', url:'https://twit.tv/shows/security-now', how:'Long-running, goes deep on the technical how of a story.'}
      ]
    },
    ctfs:{
      title:'More places to play',
      eyebrow:'Beyond what’s live right now',
      items:[
        {name:'CTFtime', host:'ctftime.org', url:'https://ctftime.org/event/list/upcoming', how:'The master calendar and team rankings — start here to see what’s on.'},
        {name:'picoCTF', host:'picoctf.org', url:'https://picoctf.org', how:'Beginner-friendly and always open — good if you’re new to CTFs.'},
        {name:'Hack The Box', host:'www.hackthebox.com', url:'https://www.hackthebox.com', how:'Practice boxes plus seasonal competitive CTFs.'},
        {name:'TryHackMe', host:'tryhackme.com', url:'https://tryhackme.com', how:'Guided rooms if you want structure while you learn.'},
        {name:'CTFlearn', host:'ctflearn.com', url:'https://ctflearn.com', how:'Practice problems organized by category — good for drilling one skill.'}
      ]
    }
  };

  function render(key){
    var d=DATA[key]; if(!d) return;
    titleEl.textContent=d.title;
    eyebrowEl.textContent=d.eyebrow;
    listEl.innerHTML='';
    d.items.forEach(function(it){
      var li=document.createElement('li');
      var img=document.createElement('img'); img.src=favicon(it.host); img.alt=''; img.loading='lazy';
      var body=document.createElement('div');
      var a=document.createElement('a'); a.href=it.url; a.target='_blank'; a.rel='noopener'; a.textContent=it.name;
      var how=document.createElement('span'); how.className='sig-dialog__how'; how.textContent=it.how;
      body.appendChild(a); body.appendChild(how);
      li.appendChild(img); li.appendChild(body);
      listEl.appendChild(li);
    });
  }

  function focusables(){ return [].slice.call(panel.querySelectorAll('a[href], button')); }

  function open(key){
    render(key);
    lastFocused=document.activeElement;
    dlg.setAttribute('aria-hidden','false');
    var f=focusables(); if(f.length) f[0].focus();
    document.addEventListener('keydown', onKeydown);
  }
  function close(){
    dlg.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', onKeydown);
    if(lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function onKeydown(e){
    if(e.key==='Escape'){ close(); return; }
    if(e.key==='Tab'){
      var f=focusables(); if(!f.length) return;
      var first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  }

  document.addEventListener('click', function(e){
    var trigger=e.target.closest && e.target.closest('[data-more]');
    if(trigger){ open(trigger.getAttribute('data-more')); return; }
    if(e.target.closest && e.target.closest('[data-close]')){ close(); }
  });
})();
