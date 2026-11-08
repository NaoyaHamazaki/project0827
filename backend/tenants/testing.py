from .models import Company, default_site


def make_company(name, site=None):
    """テスト用：所管（省略時は既定）内に所属を用意する"""
    return Company.resolve(site or default_site(), name)
