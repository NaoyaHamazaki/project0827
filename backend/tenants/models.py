from django.db import models


def next_code(model, prefix, digits, field='code'):
    """prefix＋連番（例: S001, C0001, M00001）の次の番号を返す。既存の最大値＋1"""
    last = (
        model.objects.filter(**{f'{field}__startswith': prefix})
        .order_by(f'-{field}').values_list(field, flat=True).first()
    )
    number = int(last[len(prefix):]) + 1 if last else 1
    return f'{prefix}{number:0{digits}d}'


class Site(models.Model):
    """所管（支店）。管理者・会員・会議室などはいずれかの所管に属し、
    基本的に同じ所管の中だけで関わる（マルチテナントの境界）。
    コードは S + 3桁。マスター（本社）用は S000 で固定。
    """

    MASTER_CODE = 'S000'

    code = models.CharField('所管コード', max_length=10, unique=True, blank=True)
    name = models.CharField('所管名', max_length=100)
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} {self.name}'

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = next_code(Site, 'S', 3)
        super().save(*args, **kwargs)

    @property
    def is_master(self):
        return self.code == self.MASTER_CODE


class Company(models.Model):
    """所属（契約企業）。代表1名と、代表が招待したユーザーで構成される。
    コードは C + 4桁で、所管をまたいで一意。
    """

    code = models.CharField('所属コード', max_length=10, unique=True, blank=True)
    site = models.ForeignKey(Site, on_delete=models.PROTECT, related_name='companies')
    name = models.CharField('所属名', max_length=150)
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} {self.name}'

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = next_code(Company, 'C', 4)
        super().save(*args, **kwargs)

    @classmethod
    def resolve(cls, site, name):
        """所管内で名称が一致する所属を返し、無ければ作る（名前で所属を指定する画面向け）"""
        name = (name or '').strip()
        if not name or site is None:
            return None
        company, _ = cls.objects.get_or_create(site=site, name=name)
        return company


def default_site():
    """所管を指定できない操作（所管未設定のアカウントによる登録など）で使う既定の所管。
    マスター用（S000）を除いた最初の所管。1つも無ければ作る
    """
    site = Site.objects.exclude(code=Site.MASTER_CODE).order_by('code').first()
    return site or Site.objects.create(name='本店')
