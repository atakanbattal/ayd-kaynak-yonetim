Uygulamam (Horizons üzerinde barındırılıyor) doğrudan Supabase REST API’sine istek atıyor. Zaman zaman aşağıdaki hataları alıyorum ve sebebin Horizons tarafındaki proxy/CDN katmanında querystring’in değiştirilmesi veya caching olduğundan şüpheleniyorum:
	1.	22007 – “invalid input syntax for type date: "undefined"”
Örnek hata:
Fetch error from https://wowvecfviptpfkovblhv.supabase.co/rest/v1/part_costs?production_date=eq.undefined
Mesaj: invalid input syntax for type date: “undefined”

Beklentim: İstemci, production_date filtresi seçilmemişse bu parametreyi hiç göndermiyor. Ancak sunucu tarafında production_date=eq.undefined olarak görünüyor. Bu, edge/proxy katmanında undefined değerinin stringe çevrilmesi veya URL normalizasyonu yapılması ihtimalini düşündürüyor.
	2.	PGRST204 – “Could not find the ‘lines’ column … in the schema cache”
Bu hata, Supabase/PostgREST şema önbelleği yenilenmediğinde görülebiliyor; ancak Horizons tarafında /rest/v1/* isteklerinin agresif cache’lenmesi de eski şema yanıtlarının dolaşmasına yol açabilir.

Rica Ettiklerim
	•	/rest/v1/* (Supabase REST) uç noktalarına giden/gelen isteklerde:
	•	Her türlü CDN/edge cache’i BYPASS/NO-CACHE olacak şekilde kapatır mısınız? (Querystring varyasyonlarına göre de cache’lenmesin.)
	•	Querystring’i ve header’ları hiç değiştirmeden upstream’e ilettiğinizi doğrular mısınız? (Özellikle undefined değerlerinin stringe dönüştürülmesi, boş değerlerin “eq.undefined” gibi normalize edilmesi, URL normalization/rewrites vb. kesinlikle olmamalı.)
	•	OPTIONS/GET isteklerinde CORS ve Prefer gibi header’ların aynen iletildiğini kontrol eder misiniz?
	•	Eğer bir WAF/Firewall kuralı parametreleri yeniden yazıyorsa lütfen devre dışı bırakın veya istisna tanımlayın.
	•	Sorunu inceleyebilmek için, aşağıdaki isteklere ait edge/proxy loglarında upstream’e gönderilen ham URL ve header’ları bizimle paylaşabilir misiniz?
	•	Başarılı örnek: https://wowvecfviptpfkovblhv.supabase.co/rest/v1/part_costs?select=*
	•	Hatalı örnek (günlükte görülen): https://wowvecfviptpfkovblhv.supabase.co/rest/v1/part_costs?production_date=eq.undefined

Notlar
	•	Uygulama tarafında production_date seçilmemişse bu parametre hiç eklenmiyor. Yine de hata çıktısında eq.undefined görünüyor; bu nedenle proxy/CDN’de querystring rewrite şüphesi var.
	•	PGRST204 hatası Supabase/PostgREST şema cache’ine de bağlı olabilir; biz Supabase tarafında şema yenilemesini tetikliyoruz. Horizons tarafında ise yalnızca cache/proxy’nin bu süreci bozmadığını doğrulamanızı rica ederim.

Bu kontrolleri/ayarlamaları yapıp geri dönüş sağlayabilir misiniz?