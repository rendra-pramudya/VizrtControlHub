using System;
using System.Text;
using System.Xml;
using System.Xml.XPath;
using System.Collections.Generic;

namespace TemplateCollection
{
    class TemplateCollectionExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public TemplateCollectionExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        public string GetElementCollectionUri(
            string serviceDocUri, string showName)
        {
            // Get service document.
            var serviceDoc = LoadXMLFromUri(serviceDocUri);

            // Extract directory uri.
            string directoryUri = GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection[app:categories/atom:category[@term='directory']]/@href");

            // Get directory document.
            var directoryDoc = LoadXMLFromUri(directoryUri);

            // Extract directory/shows uri.
            string directoryShowUri = GetValueFromDocumentByXPath(directoryDoc,
                "//atom:feed/atom:entry[atom:category[@term='directory'] and atom:title[text()='shows']]/atom:link[@rel='alternate']/@href");

            // Get directory/shows document.
            var directoryShowDoc = LoadXMLFromUri(directoryShowUri);

            // Extract show uri from the given showName.
            string myShowUri = GetValueFromDocumentByXPath(directoryShowDoc,
                "//atom:feed/atom:entry[atom:title[text()='" + showName + "']]/atom:link[@rel='alternate']/@href");

            // Get show document.
            var myShowDoc = LoadXMLFromUri(myShowUri);

            // Extract element collection uri.
            string elementCollectionUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            return elementCollectionUri;
        }

        public string GetTemplateCollectionUri(string elementCollectionUri)
        {
            var elementCollectionDoc = LoadXMLFromUri(elementCollectionUri);

            string templateCollectionUri = GetValueFromDocumentByXPath(elementCollectionDoc,
                "//atom:feed/atom:link[@rel='related']/@href");

            return templateCollectionUri;
        }

        public IEnumerable<string> GetListOfTemplateName(string templateCollectionUri)
        {
            List<string> ret = new List<string>();
            XmlDocument templateCollectionDoc = LoadXMLFromUri(templateCollectionUri);
            XPathNavigator nav = templateCollectionDoc.CreateNavigator();
            XPathNodeIterator it = nav.Select(
                "//atom:feed/atom:entry/atom:title", nameSpaceManager_);

            while(true)
            {
                string title = GetValueFromDocumentByXPath(
                    templateCollectionDoc, it);
                if (title.Length != 0)
                    ret.Add(title);
                else
                    break;
            }

            return ret;
        }

        public string GetTemplateCollectionEntryUri(
            string templateCollectionUri, string templateName)
        {
            var templateCollectionDoc = LoadXMLFromUri(templateCollectionUri);

            string xpath = string.Format(
                "//atom:feed/atom:entry[atom:title[text()='{0}']]/atom:link[@rel='self']/@href"
                , templateName);
            var templateCollectionEntryUri = GetValueFromDocumentByXPath(
                templateCollectionDoc, xpath);

            return templateCollectionEntryUri;
        }

        public string GetElementModelUri(
            string templateCollectionUri, string templateName)
        {
            var templateCollectionDoc = LoadXMLFromUri(templateCollectionUri);

            string xpath = string.Format(
                "//atom:feed/atom:entry[atom:title[text()='{0}']]/atom:link[@rel='alternate']/@href"
                , templateName);
            var elementModelUri = GetValueFromDocumentByXPath(
                templateCollectionDoc, xpath);

            return elementModelUri;
        }

        public void PrintVdfModel(string elementModelUri)
        {
            var elementModelDoc = LoadXMLFromUri(elementModelUri);
            PrintXmlDocument(elementModelDoc);
        }

        private XmlDocument LoadXMLFromUri(string uri)
        {
            XmlDocument doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }

        private string GetValueFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            XPathNavigator nav = doc.CreateNavigator();
            XPathNodeIterator it = nav.Select(xpath, nameSpaceManager_);
            return GetValueFromDocumentByXPath(doc, it);
        }

        private string GetValueFromDocumentByXPath(
            XmlDocument doc, XPathNodeIterator it)
        {
            if (it.MoveNext())
            {
                return it.Current.Value;
            }

            return "";
        }

        private void PrintXmlDocument(XmlDocument xml)
        {
            XmlWriterSettings settings = new XmlWriterSettings();
            settings.Indent = true;
            settings.IndentChars = "  ";
            settings.Encoding = Encoding.UTF8;
            settings.NewLineOnAttributes = true;

            //Using XmlWriter to create xml file.
            StringBuilder sb = new StringBuilder();
            using (XmlWriter writer = XmlWriter.Create(sb, settings))
            {
                xml.Save(writer);
            }
            Console.WriteLine(sb.ToString());
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.Write(
@"This is the TemplateCollection example.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio.

Press enter to list all available templates in show ""DemoShow"":");
            Console.ReadLine();
            Console.WriteLine();

            TemplateCollectionExample myExample = new TemplateCollectionExample();

            // Get element collection uri of show "DemoShow"
            string serviceDocUri = "http://127.0.0.1:8580";
            string showName = "DemoShow";
            string elementCollectionUri =
                myExample.GetElementCollectionUri(serviceDocUri, showName);

            string templateCollectionUri = myExample.GetTemplateCollectionUri(
                elementCollectionUri);
            Console.WriteLine(
                "template collection uri for show \"{0}\": {1}",
                showName, templateCollectionUri);
            Console.WriteLine();

            var templateNames = myExample.GetListOfTemplateName(templateCollectionUri);

            foreach (string templateName in templateNames)
            {
                Console.WriteLine("Template name: {0}", templateName);
                string templateCollectionEntryUri = myExample.GetTemplateCollectionEntryUri(
                templateCollectionUri, templateName);
                Console.WriteLine(
                    " - template collection entry uri: {0}", templateCollectionEntryUri);

                string elementModelUri = myExample.GetElementModelUri(
                    templateCollectionUri, templateName);
                Console.WriteLine(
                    " - element model uri: {0}", elementModelUri);

                Console.WriteLine(" - VDF model:");
                myExample.PrintVdfModel(elementModelUri);

                Console.WriteLine();
            }
        }
    }
}
