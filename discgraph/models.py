import gzip
import mongoengine
import traceback


mongodb_client = mongoengine.connect('discgraph')


class Artist(mongoengine.Document):

    ### MONGOENGINE FIELDS ###

    discogs_id = mongoengine.IntField(required=True, unique=True)
    name = mongoengine.StringField(required=True, unique=True)
    real_name = mongoengine.StringField(null=True)
    name_variations = mongoengine.ListField(mongoengine.StringField())
    aliases = mongoengine.ListField(mongoengine.StringField())
    members = mongoengine.ListField(mongoengine.ReferenceField('Artist'))
    # "groups" is inverse of "members", and therefore derived.
    groups = mongoengine.ListField(mongoengine.ReferenceField('Artist'))
    has_been_scraped = mongoengine.BooleanField(default=False)

    ### MONGOENGINE META ###

    meta = {
        'indexes': [
            'name',
            ('$name', '$real_name', '$aliases', '$name_variations'),
            ],
        }

    ### PUBLIC METHODS ###

    @classmethod
    def bootstrap(cls):
        from discgraph import bootstrap
        artists_xml_path = bootstrap.artists_xml_path
        with gzip.GzipFile(artists_xml_path, 'r') as file_pointer:
            artists_iterator = bootstrap.iterparse(file_pointer, 'artist')
            artists_iterator = bootstrap.clean_elements(artists_iterator)
            for artist_element in artists_iterator:
                artist_document = cls.from_element(artist_element)
                print(artist_document.discogs_id, artist_document.name)

    @classmethod
    def from_id_and_name(cls, discogs_id, name):
        query_set = cls.objects(discogs_id=discogs_id)
        if query_set.count():
            return query_set[0]
        document = cls(discogs_id=discogs_id, name=name)
        document.save()
        return document

    @classmethod
    def from_element(cls, element):
        discogs_id = int(element.find('id').text)
        name = element.find('name')
        if name is not None:
            name = name.text
        name = name or ''
        artist_document = cls.from_id_and_name(discogs_id, name)
        if artist_document.has_been_scraped:
            return artist_document
        real_name = element.find('name')
        if real_name is not None:
            real_name = real_name.text
        real_name = real_name or ''
        name_variations = element.find('namevariations')
        if name_variations is None or not len(name_variations):
            name_variations = []
        name_variations = [_.text for _ in name_variations if _.text]
        aliases = element.find('aliases')
        if aliases is None or not len(aliases):
            aliases = []
        aliases = [_.text for _ in aliases if _.text]
        members = element.find('members')
        member_documents = []
        if members is not None and len(members):
            for i in range(0, len(members), 2):
                member_id = int(members[i].text)
                member_name = members[i + 1].text
                member_document = cls.from_id_and_name(member_id, member_name)
                member_document.groups.append(artist_document)
                member_document.save()
                member_documents.append(member_document)
        artist_document.real_name = real_name
        artist_document.name_variations = name_variations
        artist_document.aliases = aliases
        artist_document.has_been_scraped = True
        artist_document.members = member_documents
        try:
            artist_document.save()
        except mongoengine.errors.ValidationError as exception:
            traceback.print_exc()
            print('ERROR:', discogs_id, name)
            print('    real name:      ', real_name)
            print('    name variations:', name_variations)
            print('    aliases:        ', aliases)
            print('    members:        ', member_documents)
            raise exception
        return artist_document


class Label(mongoengine.Document):

    ### MONGOENGINE FIELDS ###

    discogs_id = mongoengine.IntField(unique=True, null=True, sparse=True)
    name = mongoengine.StringField(required=True, unique=True)
    parent_label = mongoengine.ReferenceField('Label')
    sublabels = mongoengine.ListField(mongoengine.ReferenceField('Label'))
    has_been_scraped = mongoengine.BooleanField(default=False)

    ### MONGOENGINE META ###

    meta = {
        'indexes': [
            'name',
            '$name',
            ],
        }

    ### PUBLIC METHODS ###

    @classmethod
    def bootstrap(cls):
        from discgraph import bootstrap
        labels_xml_path = bootstrap.labels_xml_path
        with gzip.GzipFile(labels_xml_path, 'r') as file_pointer:
            labels_iterator = bootstrap.iterparse(file_pointer, 'label')
            labels_iterator = bootstrap.clean_elements(labels_iterator)
            for label_element in labels_iterator:
                label_document = cls.from_element(label_element)
                print(label_document.discogs_id, label_document.name)

    @classmethod
    def from_name(cls, name):
        query_set = cls.objects(name=name)
        count = query_set.count()
        if count:
            assert count == 1
            return query_set[0]
        document = cls(name=name)
        document.save()
        return document

    @classmethod
    def from_element(cls, element):
        name = element.find('name').text
        label_document = cls.from_name(name=name)
        if label_document.has_been_scraped:
            return label_document
        discogs_id = int(element.find('id').text)
        sublabels = element.find('sublabels')
        if sublabels is not None and len(sublabels):
            sublabels = [_.text for _ in sublabels if _.text]
            if sublabels:
                sublabels = cls.objects(name=sublabels)
        else:
            sublabels = []
        parent_label = element.find('parentLabel')
        if parent_label is not None:
            parent_label = parent_label.text
            if parent_label:
                parent_label = cls.from_name(parent_label)
        label_document.discogs_id = discogs_id
        label_document.sublabels = sublabels
        label_document.parent_label = parent_label
        label_document.has_been_scraped = True
        label_document.save()
        return label_document


class Release(mongoengine.Document):

    ### PUBLIC METHODS ###

    @classmethod
    def from_element(cls, element):
        pass


class Master(mongoengine.Document):

    ### PUBLIC METHODS ###

    @classmethod
    def from_element(cls, element):
        pass