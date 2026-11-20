import { DarijaScript, TutorLanguage } from '../types/harness';
import { CuratedTopic } from './curatedTopics';

type LocaleKey = 'fr' | 'ar' | 'darija-fr:arabizi' | 'darija-fr:arabic';

const LOCALIZED_TOPICS: Record<LocaleKey, Record<string, Omit<CuratedTopic, 'slug' | 'keywords'>>> = {
  fr: {
    'transformer-attention': {
      title: 'Comment fonctionne la Self-Attention des Transformers',
      explanation: {
        bigPicture:
          'Avant les Transformers, les modèles lisaient le texte mot à mot, comme à travers un trou de serrure, en perdant le contexte lointain. La self-attention permet à chaque token d’observer toute la séquence en même temps et de décider dynamiquement quels autres mots comptent le plus pour son sens.',
        mechanics: [
          'Chaque token est projeté en trois vecteurs appris : une Query (ce que je cherche), une Key (ce que j’annonce contenir) et une Value (l’information réelle que je transmets).',
          'Un token calcule des scores de similarité via le produit scalaire entre sa Query et la Key de chaque autre token, divise par √d_k pour stabiliser les gradients, puis applique softmax afin que les poids somment à 1.',
          'Ces poids d’attention multiplient les vecteurs Value et sont sommés pour produire une représentation contextuelle (par exemple, savoir si « avocat » désigne un métier ou un fruit).',
          'La multi-head attention exécute plusieurs projections en parallèle : une tête peut suivre la grammaire, une autre les pronoms, et une autre les relations sémantiques à longue distance.',
        ],
        pitfall:
          'La self-attention ne connaît pas naturellement l’ordre des mots car elle traite les tokens comme un ensemble. Sans encodage positionnel ajouté en entrée, « Le chien mord l’homme » et « L’homme mord le chien » donneraient exactement les mêmes sorties.',
        keyTerms: [
          { term: 'Query / Key / Value', definition: 'Trois projections linéaires de chaque token servant à mesurer la pertinence (Q·K) et agréger le contenu (V).' },
          { term: 'Facteur √d_k', definition: 'Division du produit scalaire par la racine de la dimension des clés pour éviter la saturation du softmax.' },
          { term: 'Masque causal', definition: 'Met à -∞ les scores des tokens futurs avant softmax lors de l’entraînement autorégressif.' },
        ],
      },
      questions: [
        {
          id: 'ta-fr-1',
          tag: 'Core Concept',
          prompt: 'Pourquoi un Transformer divise-t-il le produit scalaire Query–Key par √d_k avant d’appliquer softmax ?',
          options: [
            'Pour normaliser les embeddings de tokens à une norme euclidienne égale à 1',
            'Pour éviter que de grands produits scalaires ne poussent softmax dans des zones à gradients quasi nuls',
            'Pour garantir des poids d’attention strictement nuls sur la majorité des tokens',
            'Pour réduire la complexité mémoire quadratique de O(n²) à O(n log n)',
          ],
          correctIndex: 1,
          rationale:
            'Quand d_k augmente, la variance de Q·K grandit proportionnellement à d_k. Des valeurs extrêmes saturent softmax et font disparaître le gradient ; diviser par √d_k maintient une variance proche de 1.',
          deepNote:
            'Même avec ce facteur d’échelle, la self-attention reste quadratique O(n²) en longueur de séquence n.',
        },
        {
          id: 'ta-fr-2',
          tag: 'Misconception',
          prompt: 'Si l’on retire les encodages positionnels d’un encodeur Transformer standard et qu’on mélange les mots d’entrée, que se passe-t-il ?',
          options: [
            'Le modèle lève une erreur de dimension matricielle',
            'Seul le premier token change car l’attention circule de gauche à droite',
            'Chaque token reçoit exactement le même vecteur contextuel quel que soit l’ordre des mots',
            'La matrice d’attention devient la matrice identité',
          ],
          correctIndex: 2,
          rationale:
            'Sans encodage positionnel, la self-attention est équivariante par permutation : mélanger les entrées ne fait que permuter des vecteurs de sortie identiques.',
          deepNote:
            'C’est pourquoi les encodages sinusoïdaux ou RoPE sont indispensables pour distinguer les rôles sujet/objet.',
        },
        {
          id: 'ta-fr-3',
          tag: 'Mechanism',
          prompt: 'Dans la formule softmax(QKᵀ / √d_k)V, quel est le rôle de la matrice Value (V) ?',
          options: [
            'Elle mesure la force du lien entre deux tokens',
            'Elle stocke l’indice positionnel de chaque mot',
            'Elle fournit les vecteurs de contenu pondérés et sommés selon les poids d’attention',
            'Elle masque les tokens de padding pendant le calcul de la perte',
          ],
          correctIndex: 2,
          rationale:
            'Q et K calculent uniquement les poids de compatibilité normalisés. V transporte l’information réelle qui est mélangée selon ces poids.',
        },
        {
          id: 'ta-fr-4',
          tag: 'Application',
          prompt: 'Dans un décodeur de type GPT, comment empêche-t-on le modèle de lire les tokens futurs pendant l’entraînement ?',
          options: [
            'Les tokens futurs sont mis à zéro uniquement dans la matrice Value',
            'Les entrées triangulaires supérieures de QKᵀ sont fixées à -∞ avant le softmax',
            'Le décodeur s’exécute séquentiellement token par token pendant l’entraînement',
            'Le dropout supprime 100 % des poids vers la droite',
          ],
          correctIndex: 1,
          rationale:
            'Mettre -∞ avant softmax donne exp(-∞) = 0, annulant l’attention vers le futur tout en conservant le calcul matriciel parallèle.',
        },
        {
          id: 'ta-fr-5',
          tag: 'Mechanism',
          prompt: 'Quel est l’avantage principal de la Multi-Head Attention par rapport à une seule grande tête d’attention ?',
          options: [
            'Elle supprime le besoin de connexions résiduelles et de LayerNorm',
            'Elle permet au modèle d’observer simultanément plusieurs sous-espaces et relations différentes',
            'Elle divise par deux le nombre total de paramètres',
            'Elle garantit des arbres syntaxiques directement interprétables',
          ],
          correctIndex: 1,
          rationale:
            'Une seule distribution softmax tend à se focaliser sur un seul lien dominant ; plusieurs têtes suivent en parallèle syntaxe, coréférence et sémantique.',
        },
      ],
      relatedTopics: ['Rétropropagation & Descente de Gradient', 'Encodages Positionnels & RoPE', 'Mixture of Experts'],
    },
    'quantum-entanglement': {
      title: 'L’Intrication Quantique',
      explanation: {
        bigPicture:
          'L’intrication quantique survient lorsque deux particules ou plus partagent un seul état quantique unifié au lieu d’états séparés. Mesurer une particule révèle instantanément le résultat de l’autre, quelle que soit la distance, même si aucune n’avait de valeur définie auparavant.',
        mechanics: [
          'Contrairement à deux gants placés dans deux boîtes fermées (déjà gauche ou droite avant ouverture), un état de Bell intriqué ne possède pas de spin défini avant la mesure.',
          'Quand Alice mesure sa particule selon un axe donné et obtient « haut », la fonction d’onde partagée impose à la particule de Bob (mesurée sur le même axe) le résultat corrélé.',
          'Le théorème de Bell et les expériences montrent que ces corrélations dépassent toute théorie à variables cachées locales.',
          'L’intrication ne permet pas de communiquer plus vite que la lumière : le résultat d’Alice reste purement aléatoire tant qu’ils ne comparent pas leurs résultats par un canal classique.',
        ],
        pitfall:
          'L’intrication ne permet aucun signal supraluminique. Alice ne peut pas forcer son résultat pour envoyer un bit « 1 » à Bob : chacun observe localement une suite aléatoire 50/50.',
        keyTerms: [
          { term: 'État de Bell', definition: 'État maximalement intriqué de deux qubits : incertitude totale individuelle, corrélation parfaite conjointe.' },
          { term: 'Variables cachées locales', definition: 'Hypothèse classique d’instructions locales prédéterminées, réfutée par les tests de Bell.' },
          { term: 'Théorème de non-communication', definition: 'Preuve qu’une mesure locale ne modifie jamais les probabilités marginales observées à distance.' },
        ],
      },
      questions: [
        {
          id: 'qe-fr-1',
          tag: 'Misconception',
          prompt: 'Alice et Bob partagent une paire intriquée à des années-lumière de distance. Pourquoi Alice ne peut-elle pas envoyer un message instantané à Bob ?',
          options: [
            'L’intrication décroît exponentiellement avec la distance dans le vide',
            'Alice ne contrôle pas son résultat de mesure : les deux observateurs voient localement du hasard 50/50',
            'Le qubit de Bob met le temps de trajet de la lumière pour changer d’état',
            'Mesurer le qubit d’Alice détruit physiquement celui de Bob avant toute mesure',
          ],
          correctIndex: 1,
          rationale:
            'Comme la mesure d’Alice est intrinsèquement aléatoire, elle ne peut encoder aucun bit choisi dans les statistiques locales de Bob.',
        },
        {
          id: 'qe-fr-2',
          tag: 'Core Concept',
          prompt: 'En quoi l’intrication diffère-t-elle d’une paire de gants séparés dans deux enveloppes ?',
          options: [
            'Les gants ont déjà une latéralité fixée avant ouverture ; en intrication aucune valeur locale n’existe avant mesure',
            'Avec les gants, on ne peut pas prédire l’autre enveloppe après ouverture',
            'Les particules intriquées donnent toujours des résultats identiques',
            'Les gants violent la conservation du moment cinétique',
          ],
          correctIndex: 0,
          rationale:
            'Les gants illustrent des variables cachées locales. Les mesures selon des angles inclinés révèlent des corrélations quantiques impossibles avec des valeurs préexistantes.',
        },
        {
          id: 'qe-fr-3',
          tag: 'Mechanism',
          prompt: 'Qu’ont établi le théorème de Bell et les expériences associées ?',
          options: [
            'Les particules transportent des instructions classiques cachées',
            'Aucune théorie à variables cachées locales ne peut reproduire toutes les prédictions de la mécanique quantique',
            'La communication supraluminique est possible via des photons intriqués',
            'La gravité provoque l’effondrement de la fonction d’onde',
          ],
          correctIndex: 1,
          rationale:
            'Les expériences ont violé de façon répétée les inégalités de Bell, en accord exact avec la mécanique quantique.',
        },
        {
          id: 'qe-fr-4',
          tag: 'Application',
          prompt: 'Dans la téléportation quantique, que faut-il obligatoirement transmettre en plus de la paire intriquée ?',
          options: [
            'Un câble quantique physique reliant Alice et Bob',
            'Deux bits classiques envoyés d’Alice à Bob à une vitesse au plus égale à c',
            'Une copie clonée du qubit d’Alice',
            'Le refroidissement du qubit de Bob au zéro absolu exact',
          ],
          correctIndex: 1,
          rationale:
            'Alice envoie 2 bits classiques pour indiquer à Bob quelle porte quantique de correction appliquer, préservant ainsi la causalité.',
        },
      ],
      relatedTopics: ['Qubits & Calcul Quantique', 'Expérience des Fentes de Young', 'Inégalités de Bell'],
    },
    'crispr-cas9': {
      title: 'Édition Génétique CRISPR-Cas9',
      explanation: {
        bigPicture:
          'CRISPR-Cas9 est un système immunitaire bactérien détourné en ciseaux moléculaires programmables. Plutôt que de concevoir une nouvelle protéine pour chaque gène, on donne à l’enzyme Cas9 un court ARN guide remplaçable qui la mène exactement à la séquence d’ADN cible.',
        mechanics: [
          'Un ARN guide synthétique (gRNA) associe une séquence cible (~20 bases complémentaires à l’ADN voulu) à un échafaudage qui fixe la protéine Cas9.',
          'Cas9 scanne l’ADN en cherchant d’abord un court motif PAM (ex. NGG pour SpCas9), puis vérifie si l’ADN adjacent correspond à l’ARN guide.',
          'En cas de correspondance, Cas9 effectue une cassure double brin de l’ADN, déclenchant les mécanismes de réparation de la cellule.',
          'La voie NHEJ répare vite mais avec des erreurs (créant un knock-out du gène), tandis que la voie HDR utilise une matrice d’ADN fournie pour insérer une séquence précise.',
        ],
        pitfall:
          'Cas9 ne réécrit pas l’ADN elle-même : elle ne fait que couper. C’est la machinerie naturelle de réparation cellulaire qui réalise la suppression ou l’insertion après la coupure.',
        keyTerms: [
          { term: 'ARN guide (gRNA)', definition: 'Séquence ARN programmable d’environ 20 nucléotides dirigeant Cas9 vers une cible génomique.' },
          { term: 'Séquence PAM', definition: 'Motif court requis juste à côté de la cible pour permettre à Cas9 de se fixer et d’ouvrir l’ADN.' },
          { term: 'NHEJ vs HDR', definition: 'Réparation rapide génératrice d’indels (knock-out) vs réparation précise guidée par matrice (knock-in).' },
        ],
      },
      questions: [
        {
          id: 'cr-fr-1',
          tag: 'Misconception',
          prompt: 'Dans l’édition CRISPR-Cas9 standard, qu’est-ce qui modifie réellement la séquence d’ADN au site ciblé ?',
          options: [
            'L’enzyme Cas9 synthétise directement de nouvelles bases ADN à partir d’ARN',
            'Les systèmes de réparation de l’ADN propres à la cellule (NHEJ ou HDR) après la coupure de Cas9',
            'La séquence PAM se détache et s’insère dans le gène',
            'Une transcriptase inverse contenue dans l’ARN guide',
          ],
          correctIndex: 1,
          rationale:
            'Cas9 agit uniquement comme une endonucléase qui coupe les deux brins ; la cellule réalise ensuite les indels ou la recombinaison homologue.',
        },
        {
          id: 'cr-fr-2',
          tag: 'Mechanism',
          prompt: 'Pourquoi la séquence PAM est-elle indispensable pour que Cas9 coupe l’ADN ?',
          options: [
            'Elle sert de point de contrôle initial avant que Cas9 ne déroule l’ADN pour tester l’ARN guide',
            'Elle fournit l’ATP nécessaire à la coupure',
            'Elle empêche l’ARN guide de se replier sur lui-même',
            'Elle force la cellule à choisir la voie HDR',
          ],
          correctIndex: 0,
          rationale:
            'Le PAM permet un balayage rapide du génome et protège aussi le propre locus CRISPR des bactéries contre l’auto-coupure.',
        },
        {
          id: 'cr-fr-3',
          tag: 'Application',
          prompt: 'Pour inactiver rapidement un gène défectueux sans fournir de matrice de réparation, sur quelle voie compte-t-on ?',
          options: [
            'Homology-Directed Repair (HDR)',
            'Non-Homologous End Joining (NHEJ)',
            'Réparation par excision de bases',
            'Interférence par ARN (RNAi)',
          ],
          correctIndex: 1,
          rationale:
            'NHEJ recolle rapidement les extrémités en introduisant souvent de petites insertions/délétions (indels) qui décalent le cadre de lecture.',
        },
      ],
      relatedTopics: ['Vaccins à ARNm', 'Épigénétique', 'Prime Editing'],
    },
  },
  ar: {
    'transformer-attention': {
      title: 'كيف تعمل آلية الانتباه الذاتي (Self-Attention) في المحولات',
      explanation: {
        bigPicture:
          'قبل نماذج المحولات (Transformers)، كانت النماذج تقرأ النص كلمة بكلمة فتنسي السياق البعيد. تتيح آلية الانتباه الذاتي لكل رمز (Token) النظر إلى الجملة كاملة دفعة واحدة وتحديد الكلمات الأكثر تأثيراً في معناه ديناميكياً.',
        mechanics: [
          'يُحوَّل كل رمز إلى ثلاثة متجهات متعلَّمة: الاستعلام Query (عمّا أبحث)، والمفتاح Key (ما الذي أحتويه)، والقيمة Value (المعلومة الفعلية التي أنقلها).',
          'يحسب الرمز درجة التشابه عبر الضرب النقطي بين Query الخاص به وKey كل رمز آخر، ثم يقسم على √d_k لاستقرار التدرجات ويطبق دالة Softmax.',
          'تُضرب أوزان الانتباه الناتجة في متجهات Value وتُجمع لتكوين تمثيل يراعي السياق (مثل تمييز معنى كلمة «عين» حسب الجملة).',
          'يعمل الانتباه متعدد الرؤوس (Multi-Head Attention) بالتوازي ليتتبع كل رأس جانباً مختلفاً كالنحو أو الإحالة الضميرية أو المعنى بعيد المدى.',
        ],
        pitfall:
          'لا تمتلك آلية الانتباه الذاتي إحساساً تلقائياً بترتيب الكلمات لأنها تعامل الرموز كمجموعة غير مرتبة. دون إضافة ترميز الموضع (Positional Encoding)، تعطي جملتان معكوستان المخرجات نفسها.',
        keyTerms: [
          { term: 'Query / Key / Value', definition: 'ثلاثة إسقاطات خطية لكل رمز لحساب درجة الصلة (Q·K) وتجميع المحتوى (V).' },
          { term: 'القسمة على √d_k', definition: 'تحجيم الضرب النقطي لتفادي تشبع دالة Softmax وتلاشي التدرجات.' },
          { term: 'القناع السببي (Causal Mask)', definition: 'تعيين قيم الرموز المستقبلية إلى -∞ قبل Softmax لمنع النموذج من استباق الكلمات.' },
        ],
      },
      questions: [
        {
          id: 'ta-ar-1',
          tag: 'Core Concept',
          prompt: 'لماذا يقسم المحول ناتج الضرب النقطي بين Query وKey على √d_k قبل تطبيق Softmax؟',
          options: [
            'لتوحيد طول متجهات الكلمات إلى 1 في الفضاء الإقليدي',
            'لمنع القيم الكبيرة من دفع Softmax نحو مناطق ذات تدرجات شبه منعدمة',
            'لضمان أصفار تامة في مصفوفة الانتباه',
            'لتقليص التعقيد الزمني من O(n²) إلى O(n log n)',
          ],
          correctIndex: 1,
          rationale:
            'مع ازدياد بُعد المفتاح d_k يزداد تباين Q·K، فتدفع القيم الكبيرة دالة Softmax إلى الأطراف حيث يتلاشى التدرج؛ القسمة على √d_k تحفظ التباين قريباً من 1.',
        },
        {
          id: 'ta-ar-2',
          tag: 'Misconception',
          prompt: 'ماذا يحدث عند إزالة ترميز الموضع (Positional Encoding) من مشفّر Transformer قياسي وخلط ترتيب الكلمات؟',
          options: [
            'يحدث خطأ في أبعاد المصفوفات',
            'يتغير تمثيل الكلمة الأولى فقط',
            'يحصل كل رمز على المتجه السياقي نفسه بغض النظر عن ترتيب الكلمات',
            'تصبح مصفوفة الانتباه مصفوفة وحدة',
          ],
          correctIndex: 2,
          rationale:
            'الانتباه الذاتي متماثل تجاه تبديل الترتيب؛ وبدون ترميز الموضع لا يفرق النموذج بين الفاعل والمفعول عند تبديلهما.',
        },
        {
          id: 'ta-ar-3',
          tag: 'Mechanism',
          prompt: 'في الصيغة softmax(QKᵀ / √d_k)V، ما وظيفة المصفوفة Value (V)؟',
          options: [
            'تحديد قوة الارتباط بين كل زوج من الكلمات',
            'تخزين فهرس موضع الكلمة في الجملة',
            'توفير متجهات المحتوى التي تُرجَّح وتُجمع وفق أوزان الانتباه',
            'حجب الرموز الفارغة أثناء حساب الخسارة',
          ],
          correctIndex: 2,
          rationale:
            'تحدد Q وK أوزان الملاءمة فقط، بينما تحمل V المحتوى الفعلي الذي يُمزج بهذه الأوزان.',
        },
        {
          id: 'ta-ar-4',
          tag: 'Application',
          prompt: 'كيف يُمنع نموذج مثل GPT من قراءة الكلمات المستقبلية أثناء التدريب؟',
          options: [
            'استبدال القيم المستقبلية بأصفار في V فقط',
            'تعيين المثلث العلوي من QKᵀ إلى -∞ قبل Softmax',
            'تشغيل النموذج كلمة بكلمة تسلسلياً أثناء التدريب',
            'إسقاط 100% من الأوزان عبر Dropout',
          ],
          correctIndex: 1,
          rationale:
            'تحويل القيم المستقبلية إلى -∞ يجعل ناتج exp(-∞) يساوي صفراً بعد Softmax مع الإبقاء على الحساب المتوازي.',
        },
      ],
      relatedTopics: ['الانتشار الخلفي والانحدار التدرجي', 'الترميز الموضعي RoPE', 'نماذج خليط الخبراء'],
    },
    'quantum-entanglement': {
      title: 'التشابك الكمومي (Quantum Entanglement)',
      explanation: {
        bigPicture:
          'يحدث التشابك الكمومي عندما يتشارك جسيمان أو أكثر حالة كمومية واحدة متصلة بدلاً من حالتين مستقلتين. قياس أحد الجسيمين يكشف فوراً نتيجة قياس الآخر مهما كانت المسافة، رغم أن أياً منهما لم يكن يملك قيمة محددة قبل القياس.',
        mechanics: [
          'على عكس زوج من القفازات داخل صندوقين مغلقين حيث كل قفاز محدد مسبقاً، لا يملك الجسيمان في حالة بيل المتشابكة لفاً مغزلياً محدداً قبل القياس.',
          'عندما تقيس أليس جسيمها وتجد النتيجة «أعلى»، تتحدد فوراً نتيجة جسيم بوب المترابطة عند قياسه على المحور نفسه.',
          'أثبتت مبرهنة بيل وتجاربها أن هذه الارتباطات أقوى مما تسمح به أي نظرية متغيرات خفية محلية.',
          'لا ينقل التشابك رسائل أسرع من الضوء لأن نتيجة قياس أليس عشوائية تماماً ولا يستطيع بوب استخلاص رسالة دون اتصال كلاسيكي.',
        ],
        pitfall:
          'لا يتيح التشابك إرسال إشارات أسرع من الضوء؛ فلا يمكن لأليس إجبار جسيمها على نتيجة معينة لإرسال بتّ لبوب.',
        keyTerms: [
          { term: 'حالة بيل (Bell State)', definition: 'حالة تشابك قصوى بين كيوبتين: عشوائية فردية تامة مقابل ارتباط كلي مشترك.' },
          { term: 'المتغيرات الخفية المحلية', definition: 'فرضية وجود قيم مخزنة مسبقاً في كل جسيم، وقد دحضتها تجارب بيل.' },
          { term: 'مبرهنة عدم التواصل', definition: 'برهان رياضي يثبت أن قياس أحد الطرفين لا يغير التوزيع الاحتمالي المحلي لدى الطرف الآخر.' },
        ],
      },
      questions: [
        {
          id: 'qe-ar-1',
          tag: 'Misconception',
          prompt: 'لماذا لا تستطيع أليس استخدام زوج متشابك لإرسال رسالة فورية أسرع من الضوء إلى بوب؟',
          options: [
            'لأن التشابك يضعف أسياً مع المسافة في الفراغ',
            'لأن أليس لا تختار نتيجة قياسها؛ كلا الطرفين يرى نتائج عشوائية 50/50 محلياً',
            'لأن جسيم بوب ينتظر زمن انتقال الضوء ليتحدث',
            'لأن قياس أليس يدمر جسيم بوب فوراً',
          ],
          correctIndex: 1,
          rationale:
            'عشوائية نتيجة القياس تمنع ترميز أي رسالة في إحصائيات بوب المحلية، ولا يظهر الترابط إلا عند مقارنة النتائج تقليدياً.',
        },
        {
          id: 'qe-ar-2',
          tag: 'Core Concept',
          prompt: 'ما الفرق الجوهري بين التشابك الكمومي ووضع قفازين في ظرفين مغلقين؟',
          options: [
            'القفاز محدد مسبقاً قبل الفتح، أما في التشابك فلا توجد قيمة محلية محددة قبل القياس',
            'مع القفازات لا يمكن توقع الظرف الآخر بعد الفتح',
            'الجسيمات المتشابكة تعطي دائماً نتائج متطابقة لا متعاكسة',
            'القفازات تخالف حفظ الزخم الزاوي',
          ],
          correctIndex: 0,
          rationale:
            'القياس بزوايا مائلة في تجارب بيل يثبت أن الجسيمات لم تكن تحمل قيماً مخبأة مسبقاً.',
        },
        {
          id: 'qe-ar-3',
          tag: 'Mechanism',
          prompt: 'ماذا أثبتت مبرهنة بيل والتجارب المخبرية المرتبطة بها؟',
          options: [
            'الجسيمات تحمل تعليمات كلاسيكية خفية',
            'لا يمكن لأي نظرية متغيرات خفية محلية أن تعيد إنتاج تنبؤات ميكانيكا الكم',
            'الاتصال الفوري أسرع من الضوء ممكن بالكيوبتات',
            'الجاذبية هي سبب انهيار الدالة الموجية',
          ],
          correctIndex: 1,
          rationale:
            'انتهكت التجارب متباينة بيل مراراً بما يتطابق بدقة مع ميكانيكا الكم.',
        },
      ],
      relatedTopics: ['الحوسبة الكمومية والكيوبت', 'تجربة الشق المزدوج', 'متباينة بيل'],
    },
  },
  'darija-fr:arabizi': {
    'transformer-attention': {
      title: 'Kifach katkhdem la Self-Attention f les Transformers',
      explanation: {
        bigPicture:
          '9bel les Transformers, les modèles kano kay9raw n-nass kelma b kelma b7al ila katchouf mn wa7ed t-ta9ba sghira, w kaynsaw l-contexte l-b3id. La self-attention katkhlli kolla token ychouf la séquence kamla f d9a w y9rrer dynamiquement chkon homa l-kalimat l-mohimmin l-ma3na dyalo.',
        mechanics: [
          'Kolla token kaytprojeta l trois vecteurs apprises: Query (chno kan9lleb 3lih), Key (chno kan3len belli 3ndi), w Value (l-information l-7a9i9iya li kan3ti).',
          'Kolla token kay7seb score dyal similarité b produit scalaire bin Query dyalo w Key dyal kolla token akhor, kay9ssem 3la √d_k bach ystabiliser les gradients, w kaytbb9 softmax bach l-poids yjibou 1 f l-majmou3.',
          'Had les poids d’attention kaytderbo f les vecteurs Value w kaytjm3o bach y3tiw représentation contextuelle (matalan bach nferr9o bin "bank" dyal l-flouss wla dyal l-wad).',
          'La multi-head attention katkhdem plusieurs projections en parallèle: wa7ed tète kattebe3 la grammaire, okhra l-coréférence, w okhra l-sémantique 3la masafa twila.',
        ],
        pitfall:
          'La self-attention ma 3ndhach fikra 3la tartib l-kalimat hit kat3amel les tokens b7al ensemble bla tartib. Bla encodage positionnel f l-entrée, "L-kelb 3add r-rajel" w "R-rajel 3add l-kelb" ghadi y3tiw nefs l-output.',
        keyTerms: [
          { term: 'Query / Key / Value', definition: 'Trois projections linéaires dyal kolla token bach n9arno l-pertinence (Q·K) w njm3o l-contenu (V).' },
          { term: 'Scaling b √d_k', definition: 'L-9isma 3la racine dyal dimension des clés bach softmax ma ysatuerich w ma ydi3ouch les gradients.' },
          { term: 'Masque causal', definition: 'Kaydir -∞ l les tokens l-mosta9baliya 9bel softmax f l-génération autorégressive bach ma yghchch l-modèle.' },
        ],
      },
      questions: [
        {
          id: 'ta-dz-1',
          tag: 'Core Concept',
          prompt: '3lach f Transformer kan9ssmo produit scalaire Query–Key 3la √d_k 9bel ma ndiro softmax?',
          options: [
            'Bach n-normalisiw les embeddings l norme euclidienne katssawi 1',
            'Bach les valeurs kbar ma ydf3ouch softmax l manati9 fin l-gradient kaywlli 9rib l zero',
            'Bach n-garantiw anaho les poids d’attention ykono fihom asfar exacte',
            'Bach nna9so la complexité mémoire mn O(n²) l O(n log n)',
          ],
          correctIndex: 1,
          rationale:
            'Melli katkbber d_k, la variance dyal Q·K katkber m3aha. Les valeurs l-kbar bzzaf kaykhllew softmax ytsatura w l-gradient kaytla7; l-9isma 3la √d_k katkhlli la variance 9riba l 1.',
          deepNote:
            'Wakha had scaling, la complexité dyal self-attention katb9a O(n²) b nissba l longueur n.',
        },
        {
          id: 'ta-dz-2',
          tag: 'Misconception',
          prompt: 'Ila 7yydna les encodages positionnels mn encodeur Transformer standard w khlltna tartib l-kalimat, chno kayw9e3?',
          options: [
            'L-modèle kay3ti erreur dyal dimension matricielle',
            'Ghir awel token li kaytbeddel hit l-attention katmchi mn l-iser l l-imen',
            'Kolla token kayakhod nefs vecteur contextuel kifma kan tartib l-kalimat',
            'La matrice d’attention katwlli matrice identité',
          ],
          correctIndex: 2,
          rationale:
            'La self-attention hiya équivariante par permutation: bla encodage positionnel, tbdil tartib l-kalimat kaybdl ghir blaset nefs les vecteurs bla ma yfhem chkoun l-fa3il w chkoun l-maf3oul.',
        },
        {
          id: 'ta-dz-3',
          tag: 'Mechanism',
          prompt: 'F l-formule softmax(QKᵀ / √d_k)V, chno howa d-dor dyal matrice Value (V)?',
          options: [
            'Katchouf ch7al deux tokens mtab9in m3a ba3diyathom',
            'Katkhzzen l-indice positionnel dyal kolla token',
            'Kat3ti les vecteurs de contenu li kaytderbo f les poids d’attention w kaytjm3o',
            'Katmaski les tokens de padding f l-loss',
          ],
          correctIndex: 2,
          rationale:
            'Q w K kay7sbo ghir les poids de pertinence. V hiya li fiha l-information l-7a9i9iya li katjm3 b hadouk les poids.',
        },
        {
          id: 'ta-dz-4',
          tag: 'Application',
          prompt: 'F décodeur b7al GPT, kifach kanmn3o l-modèle ychouf les tokens l-jdayd (future tokens) wa9t l-entraînement?',
          options: [
            'Kanbeddlo les tokens l-jdayd b asfar f matrice Value bo7dha',
            'Les valeurs l-fo9aniyin (triangle supérieur) dyal QKᵀ kayakhdo -∞ 9bel softmax',
            'L-modèle kaykhdem b récurrence token b token wa9t l-entraînement',
            'Dropout kay7yed 100% dyal les poids l-imen',
          ],
          correctIndex: 1,
          rationale:
            'Ila drna -∞ 9bel softmax, exp(-∞) = 0, ya3ni attention zero l l-mosta9bal m3a l-7ifaz 3la calcul parallèle.',
        },
        {
          id: 'ta-dz-5',
          tag: 'Mechanism',
          prompt: 'Chno l-fayda dyal Multi-Head Attention 3la tête wa7da kbira b nefs dimension totale?',
          options: [
            'Kathyyed l-7aja l connexions résiduelles w LayerNorm',
            'Katkhlli l-modèle ytbbe3 plusieurs sous-espaces w relations mokhtalfa f nefs l-wa9t',
            'Kat9ssem 3adad les paramètres 3la jouj',
            'Kat3ti arbre syntaxique wad7 automatiquement',
          ],
          correctIndex: 1,
          rationale:
            'Tête wa7da katrkkz ghaliban 3la 3ala9a wa7da; plusieurs têtes kaytb3o f d9a la syntaxe, les pronoms, w l-contexte l-b3id.',
        },
      ],
      relatedTopics: ['La Rétropropagation & Descente de Gradient', 'Les Encodages Positionnels RoPE', 'Mixture of Experts'],
    },
    'quantum-entanglement': {
      title: 'L-Intrication Quantique (Quantum Entanglement)',
      explanation: {
        bigPicture:
          'L-intrication quantique katw9e3 melli jouj particules wla kter kaytcharko f état quantique wa7ed mwa7ed blasa ma ykono indépendants. Ila 9issna wa7da fihom, f l-blassa kan3rfo résultat dyal lokhra wakha tkon b3ida b bzaf, wakha 7ta wa7da ma kant 3ndha valeur m7dda 9bel la mesure.',
        mechanics: [
          'F jouj sbbat msddin f jouj bwat, kolla bwata fiha limni wla l-isri mn l-owel. F état de Bell intriqué, 7ta particule ma 3ndha spin m7dd 9bel ma n9issoha.',
          'Melli Alice kat9iss la particule dyalha 3la wa7ed l-axe w katl9a "up", la fonction d’onde partagée kat2akd belli la particule dyal Bob 3la nefs l-axe ghadi t3ti résultat mtab9 m3aha.',
          'Théorème de Bell w les expériences bino belli had les corrélations kbar mn ay théorie b variables cachées locales.',
          'Mohim bzzaf: l-intrication ma katkhllich nsifto messages asra3 mn lumière, hit résultat dyal Alice 3achwa2i 100% w Bob ma kay3rf walo 7ta ytwasslo b canal classique.',
        ],
        pitfall:
          'L-intrication ma katsiftch signal asra3 mn d-daw. Alice ma t9derch tfred 3la la particule dyalha t3ti "up" bach tsift bit "1" l Bob: kolla wa7ed kaychouf 50/50 aléatoire.',
        keyTerms: [
          { term: 'État de Bell', definition: 'État maximalement intriqué bin jouj qubits: ghomoud kamel l kolla wa7ed bo7do, w corrélation 100% melli kayt9arno.' },
          { term: 'Variables cachées locales', definition: 'Fikra classique katgol belli les particules hazzin ma3lomat mkhbya mn l-owel; tnfet b expériences de Bell.' },
          { term: 'Théorème de non-communication', definition: 'Borhan riyadi belli la mesure 3la wa7ed taraf ma katbeddelch les probabilités marginales 3nd taraf lakhor.' },
        ],
      },
      questions: [
        {
          id: 'qe-dz-1',
          tag: 'Misconception',
          prompt: 'Alice w Bob 3ndhom paire intriquée b3ida b années-lumière. 3lach Alice ma t9derch tsift message instantané l Bob?',
          options: [
            'Hit l-intrication kad3af m3a l-masafa f l-vide',
            'Alice ma kat7kkemch f résultat dyal la mesure: bjouj kaychoufo résultats aléatoires 50/50',
            'L-qubit dyal Bob kayakhod wa9t d-daw bach ybeddel l-état dyalo',
            'La mesure dyal Alice kathrres l-qubit dyal Bob 9bel ma y9isso',
          ],
          correctIndex: 1,
          rationale:
            'Hit résultat dyal Alice 3achwa2i, ma t9derch t-encoder chi bit bghato f statistiques dyal Bob. L-corrélation katban ghir melli kay9arno résultats b tari9a classique.',
        },
        {
          id: 'qe-dz-2',
          tag: 'Core Concept',
          prompt: 'Chno l-fer9 bin l-intrication quantique w jouj lgat f jouj dyal les enveloppes?',
          options: [
            'L-gat m7ddin mn l-owel 9bel ma t7ell l-enveloppe; f l-intrication ma kaynach valeur locale 9bel la mesure',
            'M3a l-gat ma t9derch ttw99e3 chno f lokhra',
            'Les particules intriquées dima kay3tiw nefs résultat',
            'L-gat kaykhalfo conservation du moment cinétique',
          ],
          correctIndex: 0,
          rationale:
            'L-gat hiya modèle dyal variables cachées locales. Les mesures b zawaya mokhtalfa f tests de Bell kaybiynno corrélations quantiques ma ymknch ykono b valeurs mkhbyin mn l-owel.',
        },
        {
          id: 'qe-dz-3',
          tag: 'Mechanism',
          prompt: 'Chno tbtat théorème de Bell w les expériences dyalha?',
          options: [
            'Les particules hazzin instructions classiques mkhbyin',
            '7ta théorie b variables cachées locales ma t9derch t3ti nefs les prédictions dyal mécanique quantique',
            'Communication asra3 mn lumière momkina b photons intriqués',
            'La gravité hiya li katdir effondrement dyal fonction d’onde',
          ],
          correctIndex: 1,
          rationale:
            'Les expériences khar9o les inégalités de Bell w 2kkdo mécanique quantique.',
        },
      ],
      relatedTopics: ['Les Qubits & Calcul Quantique', 'Expérience des Fentes de Young', 'Inégalités de Bell'],
    },
    'crispr-cas9': {
      title: 'CRISPR-Cas9 — Modification Génétique',
      explanation: {
        bigPicture:
          'CRISPR-Cas9 howa système immunitaire dyal les bactéries t7wwel l m9ass moléculaire programmable. Blasa ma nssawbo protéine jdida l kolla gène, kan3tiw l-enzyme Cas9 wa7ed ARN guide sghir kaywsselha nichan l séquence d’ADN li bghina.',
        mechanics: [
          'Un ARN guide synthétique (gRNA) kayjm3 séquence cible (~20 bases complémentaires m3a l-ADN) m3a structure katlss9 f protéine Cas9.',
          'Cas9 kat9lleb f l-ADN 3la wa7ed motif sghir smito PAM (b7al NGG l SpCas9), 3ad katchouf wach l-ADN li 7dah mtab9 m3a l-ARN guide.',
          'Melli kaytab9o, Cas9 kat9tte3 les deux brins (cassure double brin) dyal l-ADN, w l-khaliya katbday tssla7 l-kser.',
          'Tari9a dyal NHEJ katsla7 b zerba walakin b aghlat (katsdd l-gène / knock-out), ama HDR katsta3mel matrice d’ADN bach t-coller séquence jdida b di99a.',
        ],
        pitfall:
          'Cas9 ma katbeddlch l-ADN b rasha—hiya ghir kat9tte3! L-islah wla t-tbdil l-7a9i9i katdiro l-machinerie naturelle de réparation dyal l-khaliya mn ba3d l-9at3.',
        keyTerms: [
          { term: 'ARN guide (gRNA)', definition: 'Séquence ARN programmable (~20 nucléotides) katwjjeh Cas9 l blassa m7dda f l-génome.' },
          { term: 'Séquence PAM', definition: 'Motif court darori 7da l-cible bach Cas9 t9der tlss9 w t7ell l-ADN.' },
          { term: 'NHEJ vs HDR', definition: 'Réparation sri3a b indels (knock-out) vs réparation précise b matrice d’ADN (knock-in).' },
        ],
      },
      questions: [
        {
          id: 'cr-dz-1',
          tag: 'Misconception',
          prompt: 'F l-édition CRISPR-Cas9 standard, chkoun li kaydir t-tbdil l-fa3li f séquence d’ADN?',
          options: [
            'L-enzyme Cas9 katssawb bases ADN jdad mn l-ARN',
            'Les voies de réparation dyal l-khaliya (NHEJ wla HDR) mn ba3d ma kat9tte3 Cas9',
            'Séquence PAM kat7yyed w katdkhol f l-gène',
            'Transcriptase inverse dakhel l-ARN guide',
          ],
          correctIndex: 1,
          rationale:
            'Cas9 hiya endonucléase katdir ghir coupure. L-khaliya hiya li katdir les indels wla l-insertion b matrice.',
        },
        {
          id: 'cr-dz-2',
          tag: 'Mechanism',
          prompt: '3lach séquence PAM mohimma bzzaf bach Cas9 t9tte3 l-ADN?',
          options: [
            'Katkhdem b7al checkpoint awali 9bel ma Cas9 t7ell l-ADN w tverifi l-ARN guide',
            'Kat3ti l-ATP l-lazim l l-9at3',
            'Katmn3 l-ARN guide ytlwa 3la rasso',
            'Katfard 3la l-khaliya tkhtar HDR',
          ],
          correctIndex: 0,
          rationale:
            'Bla PAM, Cas9 ghadya ddiyy3 wa9t kbir kat7ell kolla paire de bases f l-génome; w katmn3 les bactéries y9tt3o l-CRISPR dyalhom.',
        },
        {
          id: 'cr-dz-3',
          tag: 'Application',
          prompt: 'Wa7ed l-ba7it bgha ywa99ef ("knock out") chi gène marid b zerba bla ma y3ti matrice de réparation. Achmen tari9a kay3tamed 3liha?',
          options: [
            'Homology-Directed Repair (HDR)',
            'Non-Homologous End Joining (NHEJ)',
            'Base Excision Repair (BER)',
            'Interférence par ARN (RNAi)',
          ],
          correctIndex: 1,
          rationale:
            'NHEJ katlss9 l-atraf b zerba w katdir sghir indels li kaykhsro cadre de lecture w kaywa99fo l-gène.',
        },
      ],
      relatedTopics: ['Les Vaccins à ARNm', 'Épigénétique', 'Prime Editing'],
    },
  },
  'darija-fr:arabic': {
    'transformer-attention': {
      title: 'كيفاش كتخدم الـ Self-Attention فـ les Transformers',
      explanation: {
        bigPicture:
          'قبل الـ Transformers، الـ modèles كانوا كيقراو النص كلمة بكلمة بحال يلا كتشوف من تقبة صغيرة وكينساو الـ contexte البعيد. الـ self-attention كتخلي كل token يشوف الـ séquence كاملة دقة وحدة ويقرر dynamiquement شكون هما الكلمات المهمين للمعنى ديالو.',
        mechanics: [
          'كل token كيتحول لـ trois vecteurs apprises: الـ Query (شنو كنقلب عليه)، والـ Key (شنو كنعلن باللي عندي)، والـ Value (المعلومة الحقيقية اللي كنعطي).',
          'كل token كيحسب score ديال similarité بالـ produit scalaire بين الـ Query ديالو والـ Key ديال كل token آخر، كيقسم على √d_k باش يـstabiliser les gradients، وكيطبق softmax باش الـ poids يجيبو 1 فالمجموع.',
          'هاد الـ poids d’attention كيتضربو فـ les vecteurs Value وكيتجمعو باش يعطيو représentation contextuelle (مثلاً نفرّقو بين المعنى ديال الكلمة حسب الجملة).',
          'الـ multi-head attention كتخدم plusieurs projections en parallèle: وحدة كتتبع الـ grammaire، أخرى الـ coréférence، وأخرى المعنى على مسافة طويلة.',
        ],
        pitfall:
          'الـ self-attention معندهاش فكرة طبيعية على ترتيب الكلمات حيت كتعامل الـ tokens بحال ensemble بلا ترتيب. بلا encodage positionnel فالمدخلات، جملتين معكوستين غادي يعطيو نفس النتيجة.',
        keyTerms: [
          { term: 'Query / Key / Value', definition: 'ثلاثة إسقاطات (projections linéaires) لكل token باش نقيسو الـ pertinence (Q·K) ونجمعو الـ contenu (V).' },
          { term: 'Scaling بـ √d_k', definition: 'القسمة على الجذر ديال dimension des clés باش الـ softmax ما يـsaturer-ش وما يضيعوش les gradients.' },
          { term: 'Masque causal', definition: 'كيحط -∞ للـ tokens المستقبلية قبل الـ softmax باش الـ modèle ما يغشش.' },
        ],
      },
      questions: [
        {
          id: 'ta-dza-1',
          tag: 'Core Concept',
          prompt: 'علاش فالـ Transformer كنقسمو الـ produit scalaire Query–Key على √d_k قبل ما نديرو softmax؟',
          options: [
            'باش نـnormaliser-و les embeddings لـ norme euclidienne كتساوي 1',
            'باش القيم الكبار ما يدفعوش الـ softmax لمناطق فين الـ gradient كيولي قريب للزيرو',
            'باش نضمنو أن الـ poids d’attention يكونو فيهم أصفار مضبوطة',
            'باش ننقصو la complexité mémoire من O(n²) لـ O(n log n)',
          ],
          correctIndex: 1,
          rationale:
            'ملي كتكبر d_k، الـ variance ديال Q·K كتكبر معاها. القيم الكبار بزاف كيخليو softmax يـsaturer والـ gradient يتلاشى؛ القسمة على √d_k كتخلي la variance قريبة لـ 1.',
        },
        {
          id: 'ta-dza-2',
          tag: 'Misconception',
          prompt: 'يلا حيّدنا الـ encodages positionnels من encodeur Transformer standard وخلّطنا ترتيب الكلمات، شنو كيوقع؟',
          options: [
            'الـ modèle كيعطي erreur ديال الأبعاد المصفوفية',
            'غير أول token اللي كيتبدل حيت الـ attention كتمشي من اليسار لليمين',
            'كل token كياخد نفس الـ vecteur contextuel كيفما كان ترتيب الكلمات',
            'مصفوفة الـ attention كتولي matrice identité',
          ],
          correctIndex: 2,
          rationale:
            'الـ self-attention متماثلة تجاه تبديل الترتيب (équivariante par permutation): بلا encodage positionnel ما كتميزش الفاعل من المفعول.',
        },
        {
          id: 'ta-dza-3',
          tag: 'Mechanism',
          prompt: 'فـ الصيغة softmax(QKᵀ / √d_k)V، شنو هو الدور ديال المصفوفة Value (V)؟',
          options: [
            'كتقيس شحال جوج tokens مترابطين بيناتهم',
            'كتخزن الـ indice positionnel ديال كل token',
            'كتعطي الـ vecteurs de contenu اللي كيتضربو فـ les poids d’attention وكيتجمعو',
            'كتحجب الـ tokens ديال الـ padding فحساب الـ loss',
          ],
          correctIndex: 2,
          rationale:
            'Q وK كيحسبو غير أوزان التوافق (les poids)، أما V هي اللي فيها المعلومة الحقيقية اللي كتتجمع.',
        },
        {
          id: 'ta-dza-4',
          tag: 'Application',
          prompt: 'فـ décodeur بحال GPT، كيفاش كنمنعو الـ modèle يقرأ الكلمات المستقبلية وقت الـ entraînement؟',
          options: [
            'كنعوضو الكلمات المستقبلية بأصفار فـ Value بوحدها',
            'القيم الفوقانية (triangle supérieur) ديال QKᵀ كتاخد -∞ قبل الـ softmax',
            'الـ décodeur كيخدم كلمة بكلمة بالتسلسل وقت التدريب',
            'الـ dropout كيحيد 100% من الأوزان لليمين',
          ],
          correctIndex: 1,
          rationale:
            'تعيين -∞ قبل الـ softmax كيخلي exp(-∞) = 0 مع الحفاظ على الحساب المتوازي.',
        },
      ],
      relatedTopics: ['La Rétropropagation & Descente de Gradient', 'Les Encodages Positionnels RoPE', 'Mixture of Experts'],
    },
    'quantum-entanglement': {
      title: 'الـ Intrication Quantique (التشابك الكمومي)',
      explanation: {
        bigPicture:
          'الـ intrication quantique كتوقع ملي جوج particules ولا كتر كيتشاركو فـ état quantique واحد موحّد بلا ما يكونو مستقلين. يلا قسنا وحدة فيهم، فالبلاصة كنعرفو النتيجة ديال الأخرى واخا تكون بعيدة بسنوات ضوئية، واخا تا وحدة ما كانت عندها قيمة محددة قبل القياس.',
        mechanics: [
          'عكس جوج سبابط مسدودين فـ جوج بواطات فين كل واحد محدد من الأول، فـ état de Bell intriqué تا particule ما عندها spin محدد قبل ما نقيسوها.',
          'ملي Alice كتقيس الـ particule ديالها على واحد الـ axe وكتلقى "up"، الـ fonction d’onde partagée كتأكد باللي الـ particule ديال Bob على نفس الـ axe غادي تعطي نتيجة مترابطة معاها.',
          'مبرهنة Bell والتجارب بينات باللي هاد الـ corrélations أقوى من أي نظرية فيها variables cachées locales.',
          'مهم بزاف: الـ intrication ما كتخليش نصيفطو رسائل أسرع من الضوء حيت النتيجة ديال Alice عشوائية 100% وما يقدرش Bob يعرف والو تا يتواصلو عبر canal classique.',
        ],
        pitfall:
          'الـ intrication ما كتصيفطش إشارة أسرع من الضوء. Alice ما تقدرش تفرض على الـ particule ديالها تعطي "up" باش تصيفط bit "1" لـ Bob: كل واحد كيشوف 50/50 عشوائي.',
        keyTerms: [
          { term: 'État de Bell', definition: 'حالة ديال intrication قصوى بين جوج qubits: عشوائية كاملة لكل واحد بوحدو، وترابط تام ملي كيتقارنو.' },
          { term: 'Variables cachées locales', definition: 'الفكرة الكلاسيكية باللي الجسيمات هازين قيم مخبية من الأول، وتنفت بـ expériences de Bell.' },
          { term: 'Théorème de non-communication', definition: 'برهان رياضي باللي القياس عند طرف ما كيبدلش الاحتمالات المحلية عند الطرف الآخر.' },
        ],
      },
      questions: [
        {
          id: 'qe-dza-1',
          tag: 'Misconception',
          prompt: 'Alice وBob عندهم paire intriquée بعيدة بسنوات ضوئية. علاش Alice ما تقدرش تصيفط message فوري لـ Bob؟',
          options: [
            'حيت الـ intrication كتضعاف مع المسافة فالفراغ',
            'Alice ما كتحكمش فنتيجة القياس: بجوج كيشوفو نتائج عشوائية 50/50',
            'الـ qubit ديال Bob كياخد وقت الضوء باش يبدل الحالة ديالو',
            'القياس ديال Alice كيهرس الـ qubit ديال Bob قبل ما يقيسو',
          ],
          correctIndex: 1,
          rationale:
            'حيت النتيجة ديال Alice عشوائية، ما تقدرش تـencoder تا رسالة فالإحصائيات المحلية ديال Bob.',
        },
        {
          id: 'qe-dza-2',
          tag: 'Core Concept',
          prompt: 'شنو الفرق بين الـ intrication quantique وجوج صبابط فـ جوج بواطات مسدودين؟',
          options: [
            'الصبابط محددين من الأول قبل الحلان؛ أما فالـ intrication ما كاينة تا قيمة محلية قبل القياس',
            'مع الصبابط ما نقدرش نتوقع البواطة الأخرى من بعد الحلان',
            'الجسيمات المتشابكة ديما كتعطي نفس النتيجة',
            'الصبابط كيخالفو conservation du moment cinétique',
          ],
          correctIndex: 0,
          rationale:
            'الصباط كيمثل variables cachées locales. القياس بزوايا مختلفة فـ tests de Bell كيبين استحالة القيم المحددة مسبقاً.',
        },
      ],
      relatedTopics: ['Les Qubits & Calcul Quantique', 'Expérience des Fentes de Young', 'Inégalités de Bell'],
    },
    'crispr-cas9': {
      title: 'CRISPR-Cas9 — تعديل الجينات',
      explanation: {
        bigPicture:
          'CRISPR-Cas9 هو نظام مناعي ديال البكتيريا تحول لمقص جزيئي programmable. بلاصة ما نصاوبو protéine جديدة لكل gène، كنعطيو للـ enzyme Cas9 واحد الـ ARN guide صغير كيوصلها نيشان للـ séquence d’ADN اللي بغينا.',
        mechanics: [
          'واحد الـ ARN guide synthétique (gRNA) كيجمع séquence cible (~20 bases متكاملة مع الـ ADN) مع structure كتلصق فـ protéine Cas9.',
          'Cas9 كتقلب فالـ ADN على واحد الـ motif صغير سميتو PAM (بحال NGG لـ SpCas9)، عاد كتشوف واش الـ ADN اللي حداه متطابق مع الـ ARN guide.',
          'ملي كيتطابقو، Cas9 كتقطع الجوج سلاسل (cassure double brin) ديال الـ ADN، والخلية كتبدا تصلح الكسر.',
          'الطريقة ديال NHEJ كتصلح بالزربة ولكن بأغلاط (كتسد الـ gène / knock-out)، أما HDR كتستعمل matrice d’ADN باش تلصق séquence جديدة بدقة.',
        ],
        pitfall:
          'Cas9 ما كتبدلش الـ ADN براسها—هي غير كتقطع! الإصلاح والتبديل الحقيقي كتديرو الـ machinerie naturelle de réparation ديال الخلية من بعد التقطيع.',
        keyTerms: [
          { term: 'ARN guide (gRNA)', definition: 'سلسلة ARN قابلة للبرمجة (~20 nucléotides) كتوجه Cas9 لبلاصة محددة فالـ génome.' },
          { term: 'Séquence PAM', definition: 'Motif قصير ضروري حدا الهدف باش Cas9 تقدر تلصق وتحل الـ ADN.' },
          { term: 'NHEJ vs HDR', definition: 'إصلاح سريع كيدير indels (knock-out) مقابل إصلاح دقيق بـ matrice d’ADN.' },
        ],
      },
      questions: [
        {
          id: 'cr-dza-1',
          tag: 'Misconception',
          prompt: 'فـ CRISPR-Cas9 العادي، شكون اللي كيدير التغيير الفعلي فـ séquence d’ADN؟',
          options: [
            'الـ enzyme Cas9 كتصاوب قواعد ADN جداد من الـ ARN',
            'مسارات إصلاح الـ ADN ديال الخلية (NHEJ ولا HDR) من بعد التقطيع ديال Cas9',
            'سلسلة PAM كتحيد وكتدخل فالـ gène',
            'Transcriptase inverse داخل الـ ARN guide',
          ],
          correctIndex: 1,
          rationale:
            'Cas9 هي endonucléase كتقطع فقط؛ الخلية هي اللي كتكمل التعديل عبر NHEJ أو HDR.',
        },
        {
          id: 'cr-dza-2',
          tag: 'Mechanism',
          prompt: 'علاش سلسلة PAM مهمة بزاف باش Cas9 تقطع الـ ADN؟',
          options: [
            'كتخدم بحال نقطة تفتيش أولية قبل ما Cas9 تحل الـ ADN وتتحقق من الـ ARN guide',
            'كتعطي الـ ATP اللازم للتقطيع',
            'كتمنع الـ ARN guide يتلوى على راسو',
            'كتفرض على الخلية تختار HDR',
          ],
          correctIndex: 0,
          rationale:
            'بلا PAM، Cas9 غادي تضيع وقت كبير وهي كتحل كل قاعدة فالـ génome كامل.',
        },
      ],
      relatedTopics: ['Les Vaccins à ARNm', 'Épigénétique', 'Prime Editing'],
    },
  },
};

export function findLocalizedCuratedTopic(
  slug: string,
  language: TutorLanguage,
  script: DarijaScript
): Omit<CuratedTopic, 'slug' | 'keywords'> | null {
  if (language === 'en') return null;
  const key: LocaleKey =
    language === 'darija-fr'
      ? `darija-fr:${script}`
      : language === 'fr'
        ? 'fr'
        : 'ar';
  return LOCALIZED_TOPICS[key]?.[slug] ?? null;
}
