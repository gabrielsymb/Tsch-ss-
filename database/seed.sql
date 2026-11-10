INSERT INTO sources (title, url, publisher, license, accessed_on)
VALUES
    (
        'Antiderivatives',
        'https://openstax.org/books/calculus-volume-1/pages/4-10-antiderivatives',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Differentiation Rules',
        'https://openstax.org/books/calculus-volume-1/pages/3-3-differentiation-rules',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Derivatives of Trigonometric Functions',
        'https://openstax.org/books/calculus-volume-1/pages/3-5-derivatives-of-trigonometric-functions',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'The Chain Rule',
        'https://openstax.org/books/calculus-volume-1/pages/3-6-the-chain-rule',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Derivatives of Exponential and Logarithmic Functions',
        'https://openstax.org/books/calculus-volume-1/pages/3-9-derivatives-of-exponential-and-logarithmic-functions',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Substitution',
        'https://openstax.org/books/calculus-volume-2/pages/1-5-substitution',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Integration by Parts',
        'https://openstax.org/books/calculus-volume-2/pages/3-1-integration-by-parts',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Trigonometric Integrals',
        'https://openstax.org/books/calculus-volume-2/pages/3-2-trigonometric-integrals',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Trigonometric Substitution',
        'https://openstax.org/books/calculus-volume-2/pages/3-3-trigonometric-substitution',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    ),
    (
        'Partial Fractions',
        'https://openstax.org/books/calculus-volume-2/pages/3-4-partial-fractions',
        'OpenStax',
        'CC BY 4.0',
        DATE '2026-11-09'
    )
ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    publisher = EXCLUDED.publisher,
    license = EXCLUDED.license,
    accessed_on = EXCLUDED.accessed_on;

INSERT INTO categories (slug, name, description)
VALUES
    ('algebraic', 'Algébricas', 'Potências, constantes e regras algébricas.'),
    ('derivative-rules', 'Regras de derivação', 'Regras para somas, produtos, quocientes e funções compostas.'),
    ('exponential-logarithmic', 'Exponenciais e logaritmos', 'Funções exponenciais, logarítmicas e suas primitivas.'),
    ('trigonometric', 'Trigonométricas', 'Derivadas e integrais de funções trigonométricas.'),
    ('inverse-trigonometric', 'Trigonométricas inversas', 'Fórmulas associadas a funções trigonométricas inversas.'),
    ('integration-techniques', 'Técnicas de integração', 'Métodos para integrais que não se resolvem diretamente.')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO entries (
    slug, title, kind, category_slug, expression, result, conditions, notes, source_id
)
SELECT item.slug, item.title, item.kind, item.category_slug, item.expression, item.result,
       item.conditions, item.notes, source.id
FROM (VALUES
    ('derivative-constant', 'Derivada de uma constante', 'derivative', 'algebraic',
     'f(x)=c', '\frac{d}{dx}c=0', 'c é constante.',
     'A derivada de uma função constante é zero.', 'Differentiation Rules'),
    ('derivative-power', 'Regra da potência', 'derivative', 'algebraic',
     'f(x)=x^n', '\frac{d}{dx}x^n=nx^{n-1}', 'n é constante; considerar o domínio da potência.',
     'Para polinômios, aplica-se termo a termo.', 'Differentiation Rules'),
    ('derivative-sum', 'Soma e diferença', 'derivative', 'derivative-rules',
     'f(x)=u(x)\pm v(x)', '\frac{d}{dx}(u\pm v)=u''\pm v''',
     'u e v são diferenciáveis.',
     'A derivada distribui-se sobre somas e diferenças.', 'Differentiation Rules'),
    ('derivative-constant-multiple', 'Múltiplo constante', 'derivative', 'derivative-rules',
     'f(x)=cu(x)', '\frac{d}{dx}(cu)=cu''',
     'c é constante e u é diferenciável.',
     'A constante multiplicativa pode ser mantida fora da derivada.', 'Differentiation Rules'),
    ('derivative-product', 'Regra do produto', 'derivative', 'derivative-rules',
     'f(x)=u(x)v(x)', '\frac{d}{dx}(uv)=u''v+uv''',
     'u e v são diferenciáveis.',
     'Não é, em geral, o produto das derivadas.', 'Differentiation Rules'),
    ('derivative-quotient', 'Regra do quociente', 'derivative', 'derivative-rules',
     'f(x)=\frac{u(x)}{v(x)}',
     '\frac{d}{dx}\left(\frac{u}{v}\right)=\frac{u''v-uv''}{v^2}',
     'u e v são diferenciáveis e v(x)\ne0.',
     'A ordem no numerador é derivada de cima vezes baixo, menos cima vezes derivada de baixo.', 'Differentiation Rules'),
    ('derivative-chain-rule', 'Regra da cadeia', 'derivative', 'derivative-rules',
     'f(x)=u(v(x))', '\frac{d}{dx}u(v(x))=u''(v(x))v''(x)',
     'v é diferenciável em x e u é diferenciável em v(x).',
     'Deriva-se a função externa e multiplica-se pela derivada da função interna.', 'The Chain Rule'),
    ('derivative-exponential-e', 'Derivada da exponencial natural', 'derivative', 'exponential-logarithmic',
     'f(x)=e^{u(x)}', '\frac{d}{dx}e^{u(x)}=e^{u(x)}u''(x)',
     'u é diferenciável.',
     'Caso particular: \frac{d}{dx}e^x=e^x.', 'Derivatives of Exponential and Logarithmic Functions'),
    ('derivative-exponential-base', 'Derivada de uma exponencial de base a', 'derivative', 'exponential-logarithmic',
     'f(x)=a^{u(x)}',
     '\frac{d}{dx}a^{u(x)}=a^{u(x)}\ln(a)u''(x)',
     'a>0 e u é diferenciável.',
     'Para a=e, recupera-se a derivada da exponencial natural.', 'Derivatives of Exponential and Logarithmic Functions'),
    ('derivative-log-natural', 'Derivada do logaritmo natural', 'derivative', 'exponential-logarithmic',
     'f(x)=\ln(u(x))', '\frac{d}{dx}\ln(u(x))=\frac{u''(x)}{u(x)}',
     'u(x)>0 e u é diferenciável.',
     'A condição u(x)>0 garante que o logaritmo natural esteja definido nos reais.', 'Derivatives of Exponential and Logarithmic Functions'),
    ('derivative-log-base', 'Derivada do logaritmo de base a', 'derivative', 'exponential-logarithmic',
     'f(x)=\log_a(u(x))',
     '\frac{d}{dx}\log_a(u(x))=\frac{u''(x)}{u(x)\ln(a)}',
     'a>0, a\ne1, u(x)>0 e u é diferenciável.',
     'O logaritmo de base a pode ser reescrito usando o logaritmo natural.', 'Derivatives of Exponential and Logarithmic Functions'),
    ('derivative-sine', 'Derivada do seno', 'derivative', 'trigonometric',
     'f(x)=\sin(x)', '\frac{d}{dx}\sin(x)=\cos(x)',
     'x em radianos.',
     'Para \sin(u(x)), aplicar também a regra da cadeia.', 'Derivatives of Trigonometric Functions'),
    ('derivative-cosine', 'Derivada do cosseno', 'derivative', 'trigonometric',
     'f(x)=\cos(x)', '\frac{d}{dx}\cos(x)=-\sin(x)',
     'x em radianos.',
     'Para \cos(u(x)), aplicar também a regra da cadeia.', 'Derivatives of Trigonometric Functions'),
    ('derivative-tangent', 'Derivada da tangente', 'derivative', 'trigonometric',
     'f(x)=\tan(x)', '\frac{d}{dx}\tan(x)=\sec^2(x)',
     'Onde \cos(x)\ne0; x em radianos.',
     'A função não está definida nos pontos em que \cos(x)=0.', 'Derivatives of Trigonometric Functions'),
    ('derivative-cotangent', 'Derivada da cotangente', 'derivative', 'trigonometric',
     'f(x)=\cot(x)', '\frac{d}{dx}\cot(x)=-\csc^2(x)',
     'Onde \sin(x)\ne0; x em radianos.', '', 'Derivatives of Trigonometric Functions'),
    ('derivative-secant', 'Derivada da secante', 'derivative', 'trigonometric',
     'f(x)=\sec(x)', '\frac{d}{dx}\sec(x)=\sec(x)\tan(x)',
     'Onde \cos(x)\ne0; x em radianos.', '', 'Derivatives of Trigonometric Functions'),
    ('derivative-cosecant', 'Derivada da cossecante', 'derivative', 'trigonometric',
     'f(x)=\csc(x)', '\frac{d}{dx}\csc(x)=-\csc(x)\cot(x)',
     'Onde \sin(x)\ne0; x em radianos.', '', 'Derivatives of Trigonometric Functions'),
    ('derivative-arcsine', 'Derivada do arco-seno', 'derivative', 'inverse-trigonometric',
     'f(x)=\arcsin(x)', '\frac{d}{dx}\arcsin(x)=\frac{1}{\sqrt{1-x^2}}',
     '-1<x<1.',
     'Nos extremos, a expressão da derivada não é finita.', 'Antiderivatives'),
    ('derivative-arctangent', 'Derivada do arco-tangente', 'derivative', 'inverse-trigonometric',
     'f(x)=\arctan(x)', '\frac{d}{dx}\arctan(x)=\frac{1}{1+x^2}',
     'x real.', '', 'Antiderivatives'),
    ('integral-constant', 'Integral de uma constante', 'integral', 'algebraic',
     '\int c\,dx', 'cx+C', 'c é constante.',
     'C representa uma constante arbitrária de integração.', 'Antiderivatives'),
    ('integral-power', 'Regra da potência para integrais', 'integral', 'algebraic',
     '\int x^n\,dx', '\frac{x^{n+1}}{n+1}+C',
     'n\ne-1; considerar o domínio da potência.',
     'O caso n=-1 é separado: \int\frac{1}{x}\,dx=\ln|x|+C.', 'Antiderivatives'),
    ('integral-power-chain', 'Potência de uma função por sua derivada', 'integral', 'algebraic',
     '\int [g(x)]^n g''(x)\,dx',
     '\frac{[g(x)]^{n+1}}{n+1}+C',
     'n\ne-1 e g é diferenciável.',
     'É uma aplicação direta da substituição u=g(x).', 'Substitution'),
    ('integral-reciprocal', 'Integral de um sobre x', 'integral', 'exponential-logarithmic',
     '\int\frac{1}{x}\,dx', '\ln|x|+C',
     'x\ne0; a fórmula vale em intervalos que não atravessam zero.',
     'O valor absoluto contempla os intervalos positivos e negativos.', 'Antiderivatives'),
    ('integral-exponential-e', 'Integral da exponencial natural', 'integral', 'exponential-logarithmic',
     '\int e^x\,dx', 'e^x+C', '',
     'A derivada de e^x é a própria e^x.', 'Antiderivatives'),
    ('integral-exponential-e-chain', 'Exponencial natural composta', 'integral', 'exponential-logarithmic',
     '\int e^{g(x)}g''(x)\,dx', 'e^{g(x)}+C',
     'g é diferenciável.',
     'A derivada da parte interna deve aparecer multiplicando o integrando.', 'Substitution'),
    ('integral-exponential-base', 'Integral de uma exponencial de base a', 'integral', 'exponential-logarithmic',
     '\int a^x\,dx', '\frac{a^x}{\ln(a)}+C',
     'a>0 e a\ne1.',
     'A fórmula decorre da derivada de a^x.', 'Antiderivatives'),
    ('integral-exponential-base-chain', 'Exponencial de base a composta', 'integral', 'exponential-logarithmic',
     '\int a^{g(x)}g''(x)\,dx',
     '\frac{a^{g(x)}}{\ln(a)}+C',
     'a>0, a\ne1 e g é diferenciável.',
     'A derivada da parte interna deve aparecer multiplicando o integrando.', 'Substitution'),
    ('integral-log-chain', 'Logaritmo de uma função sobre a função', 'integral', 'exponential-logarithmic',
     '\int\frac{g''(x)}{g(x)}\,dx', '\ln|g(x)|+C',
     'g é diferenciável e g(x)\ne0 no intervalo.',
     'A fórmula vale em cada intervalo que não contém zeros de g.', 'Substitution'),
    ('integral-sine', 'Integral do seno', 'integral', 'trigonometric',
     '\int\sin(x)\,dx', '-\cos(x)+C', 'x em radianos.', '', 'Antiderivatives'),
    ('integral-cosine', 'Integral do cosseno', 'integral', 'trigonometric',
     '\int\cos(x)\,dx', '\sin(x)+C', 'x em radianos.', '', 'Antiderivatives'),
    ('integral-sine-chain', 'Seno composto multiplicado pela derivada interna', 'integral', 'trigonometric',
     '\int\cos(g(x))g''(x)\,dx', '\sin(g(x))+C',
     'g é diferenciável; ângulos em radianos.',
     'Aplicação da regra da cadeia em sentido inverso.', 'Substitution'),
    ('integral-cosine-chain', 'Cosseno composto multiplicado pela derivada interna', 'integral', 'trigonometric',
     '\int\sin(g(x))g''(x)\,dx', '-\cos(g(x))+C',
     'g é diferenciável; ângulos em radianos.',
     'Aplicação da regra da cadeia em sentido inverso.', 'Substitution'),
    ('integral-secant-squared', 'Integral de secante ao quadrado', 'integral', 'trigonometric',
     '\int\sec^2(x)\,dx', '\tan(x)+C', 'x em radianos.', '', 'Antiderivatives'),
    ('integral-cosecant-squared', 'Integral de cossecante ao quadrado', 'integral', 'trigonometric',
     '\int\csc^2(x)\,dx', '-\cot(x)+C', 'x em radianos.', '', 'Antiderivatives'),
    ('integral-secant-tangent', 'Integral de secante vezes tangente', 'integral', 'trigonometric',
     '\int\sec(x)\tan(x)\,dx', '\sec(x)+C', 'x em radianos.', '', 'Antiderivatives'),
    ('integral-cosecant-cotangent', 'Integral de cossecante vezes cotangente', 'integral', 'trigonometric',
     '\int\csc(x)\cot(x)\,dx', '-\csc(x)+C', 'x em radianos.', '', 'Antiderivatives'),
    ('integral-arctangent', 'Integral que resulta em arco-tangente', 'integral', 'inverse-trigonometric',
     '\int\frac{1}{1+x^2}\,dx', '\arctan(x)+C', 'x real.', '', 'Antiderivatives'),
    ('integral-arcsine', 'Integral que resulta em arco-seno', 'integral', 'inverse-trigonometric',
     '\int\frac{1}{\sqrt{1-x^2}}\,dx', '\arcsin(x)+C',
     '-1<x<1 para a expressão integranda real.',
     'A primitiva pode ser estendida continuamente aos extremos do intervalo.', 'Antiderivatives'),
    ('technique-substitution', 'Integração por substituição', 'technique', 'integration-techniques',
     '\int f(g(x))g''(x)\,dx',
     'u=g(x),\quad du=g''(x)\,dx,\quad \int f(u)\,du',
     'As hipóteses de continuidade devem valer no intervalo considerado.',
     'Reconhece-se a derivada da função interna, possivelmente a menos de uma constante.', 'Substitution'),
    ('technique-integration-by-parts', 'Integração por partes', 'technique', 'integration-techniques',
     '\int u\,dv', 'uv-\int v\,du',
     'u e v devem ter as condições de diferenciabilidade e integrabilidade necessárias.',
     'A escolha de u e dv deve transformar a integral restante em uma mais simples.', 'Integration by Parts'),
    ('technique-trigonometric-integrals', 'Integrais de potências trigonométricas', 'technique', 'integration-techniques',
     '\int\sin^m(x)\cos^n(x)\,dx',
     'Use identidades trigonométricas e substituição quando uma potência permitir.',
     'A estratégia depende da paridade dos expoentes m e n.',
     'Para potências pares, identidades de redução de potência são uma ferramenta comum.', 'Trigonometric Integrals'),
    ('technique-trigonometric-substitution', 'Substituição trigonométrica', 'technique', 'integration-techniques',
     '\sqrt{a^2-x^2},\quad\sqrt{a^2+x^2},\quad\sqrt{x^2-a^2}',
     'x=a\sin(\theta),\quad x=a\tan(\theta),\quad x=a\sec(\theta),\text{ respectivamente}',
     'a>0; o domínio e os intervalos precisam ser considerados.',
     'Escolhe-se a substituição conforme o radical presente e retorna-se à variável original.', 'Trigonometric Substitution'),
    ('technique-partial-fractions', 'Decomposição em frações parciais', 'technique', 'integration-techniques',
     '\int\frac{P(x)}{Q(x)}\,dx',
     'Decomponha \frac{P(x)}{Q(x)} em frações mais simples e integre cada parcela.',
     'Antes da decomposição, a fração deve ser própria; se necessário, faça divisão polinomial.',
     'A forma da decomposição depende dos fatores do denominador.', 'Partial Fractions')
) AS item(slug, title, kind, category_slug, expression, result, conditions, notes, source_title)
JOIN sources AS source ON source.title = item.source_title
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    kind = EXCLUDED.kind,
    category_slug = EXCLUDED.category_slug,
    expression = EXCLUDED.expression,
    result = EXCLUDED.result,
    conditions = EXCLUDED.conditions,
    notes = EXCLUDED.notes,
    source_id = EXCLUDED.source_id,
    updated_at = NOW();

INSERT INTO entry_aliases (entry_id, alias)
SELECT entry.id, alias.value
FROM (VALUES
    ('derivative-power', 'regra da potência'),
    ('derivative-power', 'power rule'),
    ('integral-power', 'primitiva de x elevado a n'),
    ('technique-substitution', 'mudança de variável'),
    ('technique-substitution', 'u-substitution')
) AS alias(entry_slug, value)
JOIN entries AS entry ON entry.slug = alias.entry_slug
ON CONFLICT DO NOTHING;

INSERT INTO entry_notations (entry_id, label, format, notation)
SELECT entry.id, notation.label, notation.format, notation.value
FROM (VALUES
    ('integral-exponential-e', 'Notação Unicode', 'unicode', '∫ eˣ dx'),
    ('integral-power', 'Notação em texto', 'plain_text', 'integral de x^n dx')
) AS notation(entry_slug, label, format, value)
JOIN entries AS entry ON entry.slug = notation.entry_slug
ON CONFLICT DO NOTHING;

INSERT INTO entry_examples (entry_id, title, prompt, result, steps, sort_order)
SELECT entry.id, example.title, example.prompt, example.result, example.steps, 10
FROM (VALUES
    ('derivative-power', 'Derivada de x ao cubo',
     'Determine f''(x) para f(x)=x^3.',
     'f''(x)=3x^2.',
     ARRAY[
         'Compare x^3 com x^n e identifique n=3.',
         'Aplique a regra da potência: d(x^n)/dx = n x^(n-1).',
         'Substitua n=3 e simplifique para obter 3x^2.'
     ]),
    ('integral-power', 'Primitiva de x ao quadrado',
     'Calcule a integral indefinida de x^2.',
     'x^3/3+C.',
     ARRAY[
         'Identifique n=2; como n não é -1, a regra da potência se aplica.',
         'Some 1 ao expoente e divida pelo novo expoente: x^(2+1)/(2+1).',
         'Adicione a constante de integração C.'
     ])
) AS example(entry_slug, title, prompt, result, steps)
JOIN entries AS entry ON entry.slug = example.entry_slug
ON CONFLICT (entry_id, title) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    result = EXCLUDED.result,
    steps = EXCLUDED.steps,
    sort_order = EXCLUDED.sort_order;

INSERT INTO entry_applications (entry_id, title, field_name, description, example, sort_order)
SELECT entry.id, application.title, application.field_name,
       application.description, application.example, 10
FROM (VALUES
    ('derivative-power', 'Velocidade em movimento uniformemente acelerado',
     'Física', 'A derivada da posição em relação ao tempo fornece a velocidade instantânea.',
     'Se s(t)=t^2 para t≥0, então v(t)=s''(t)=2t.')
) AS application(entry_slug, title, field_name, description, example)
JOIN entries AS entry ON entry.slug = application.entry_slug
ON CONFLICT (entry_id, title) DO UPDATE SET
    field_name = EXCLUDED.field_name,
    description = EXCLUDED.description,
    example = EXCLUDED.example,
    sort_order = EXCLUDED.sort_order;

INSERT INTO entry_relations (entry_id, related_entry_id, relation_type)
SELECT entry.id, related.id, 'related'
FROM entries AS entry
JOIN entries AS related ON related.slug = 'integral-power'
WHERE entry.slug = 'derivative-power'
ON CONFLICT DO NOTHING;
