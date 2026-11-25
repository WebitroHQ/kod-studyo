# >>> token-skill (otomatik; elle düzenleme) >>>
## Proje haritası (token skill — graphify)
Bu projede `graphify-out/graph.json` bir kod haritasıdır. Amaç: projeyi baştan taramamak, az token harcamak.
- Kod/mimari sorusunda (nerede, neyi çağırıyor, akış nasıl) ilk grep/okumadan ÖNCE: `graphify query "<soru>"`. İlişki için `graphify path "A" "B"`, tek kavram için `graphify explain "X"`. Ham dosyayı yalnız sorgunun gösterdiği satırlar için aç. Bu kuralı kod keşfi yapan her alt ajana da yaz.
- `graphify-out/graph.json` dosyasını ASLA bütün olarak okuma/cat'leme (yüz binlerce token). `GRAPH_REPORT.md` yalnız genel mimari bakış için.
- Kod değiştirdikten sonra: `bash ~/.claude/skills/token/scripts/token.sh update .` (AST, LLM yok, saniyeler). Harita yoksa veya "ESKİ" ise önce `update`.
- Harita yanlış/eksik görünüyorsa kullanıcıya söyle; sessizce ham taramaya dönme.
# <<< token-skill <<<
