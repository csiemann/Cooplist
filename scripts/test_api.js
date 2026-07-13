(async () => {
  const API = 'http://localhost:3000/api';
  const log = (...args) => console.log(...args);

  async function post(path, body, token) {
    const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = text; }
    return { status: res.status, data };
  }
  async function get(path, token) {
    const res = await fetch(API + path, { method: 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = text; }
    return { status: res.status, data };
  }

  log('1) Login admin');
  const adminLogin = await post('/auth/login', { email: 'admin@admin.com', password: 'admin1' });
  log('admin login ->', adminLogin.status, JSON.stringify(adminLogin.data));
  const adminToken = adminLogin.data?.token;

  log('\n2) Login moderator');
  const modLogin = await post('/auth/login', { email: 'moderador@moderador.com', password: 'moderador' });
  log('mod login ->', modLogin.status, JSON.stringify(modLogin.data));
  const modToken = modLogin.data?.token;

  if (!adminToken) { log('ERROR: admin token missing'); process.exit(1); }

  log('\n3) Get playlists as admin');
  const pls = await get('/playlists', adminToken);
  log('playlists ->', pls.status, JSON.stringify(pls.data));

  let playlistId = null;
  if (Array.isArray(pls.data) && pls.data.length > 0) {
    playlistId = pls.data[0].id;
    log('Using existing playlistId=', playlistId);
  } else {
    log('No playlists found - creating one');
    const created = await post('/playlists', { name: 'auto-test-playlist', description: 'created-by-test-script' }, adminToken);
    log('create playlist ->', created.status, JSON.stringify(created.data));
    playlistId = created.data?.playlist?.id;
  }

  if (!playlistId) { log('ERROR: playlist id missing'); process.exit(1); }

  log('\n4) Add song as admin');
  const addSong = await post(`/playlists/${playlistId}/songs`, { spotify_track_id: 'track-admin-1', track_name: 'Admin Song 1', artist_name: 'Test Artist', track_duration_ms: 200000 }, adminToken);
  log('addSong admin ->', addSong.status, JSON.stringify(addSong.data));

  log('\n5) Get playlist details as admin');
  const details1 = await get(`/playlists/${playlistId}`, adminToken);
  log('details ->', details1.status, JSON.stringify(details1.data));

  log('\n6) Add song as moderator');
  const addSongMod = await post(`/playlists/${playlistId}/songs`, { spotify_track_id: 'track-mod-1', track_name: 'Mod Song 1', artist_name: 'Mod Artist', track_duration_ms: 180000 }, modToken);
  log('addSong mod ->', addSongMod.status, JSON.stringify(addSongMod.data));

  log('\n7) Get playlist details as admin after mod add');
  const details2 = await get(`/playlists/${playlistId}`, adminToken);
  log('details post-mod ->', details2.status, JSON.stringify(details2.data));

  log('\n8) Get members and attempt moderator remove admin');
  const members = await get(`/playlists/${playlistId}/members`, adminToken);
  log('members ->', members.status, JSON.stringify(members.data));
  // find the member row for admin user
  let adminMemberRow = null;
  if (Array.isArray(members.data)) {
    for (const m of members.data) {
      if (m.email === 'admin@admin.com') { adminMemberRow = m; break; }
    }
  }
  if (!adminMemberRow) {
    log('Could not find admin member row in members response');
  } else {
    log('Admin member row:', JSON.stringify(adminMemberRow));
    // The backend returns id as 'id' which is the user id; but removal endpoint expects memberId (playlist_members.id). Our members query selects u.id as id currently. We need to query raw playlist_members to get member row id.
    log('\n8b) Fetch raw playlist_members rows for this playlist to find row id');
    // Call a simple endpoint: /api/playlists/<id> returns members with pm.role but not pm.id. We'll fetch directly from API DB using /api/playlists/:id? (members had no pm.id). So instead, try to find by requesting invites or using database access is not possible. We'll attempt to remove using user id as memberId to test behavior.
    const attemptRemove = await fetch('http://localhost:3000/api/playlists/'+playlistId+'/members/'+adminMemberRow.id, { method: 'DELETE', headers: { Authorization: 'Bearer '+modToken } });
    const attemptText = await attemptRemove.text();
    let attemptData;
    try { attemptData = JSON.parse(attemptText); } catch(e) { attemptData = attemptText; }
    log('mod remove admin ->', attemptRemove.status, JSON.stringify(attemptData));
  }

  log('\n9) Final playlist details');
  const final = await get(`/playlists/${playlistId}`, adminToken);
  log('final details ->', final.status, JSON.stringify(final.data));

  log('\nTESTS COMPLETE');
})();
